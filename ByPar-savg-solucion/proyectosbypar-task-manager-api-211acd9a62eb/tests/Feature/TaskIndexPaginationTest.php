<?php

namespace Tests\Feature;

use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskIndexPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_without_pagination_params_it_returns_all_tasks_in_the_original_shape(): void
    {
        Task::factory()->count(5)->create();

        $response = $this->getJson('/api/tasks')->assertOk();

        $this->assertCount(5, $response->json('data'));
        $response->assertJsonMissingPath('meta');
    }

    public function test_it_paginates_when_asked_to(): void
    {
        Task::factory()->count(5)->create();

        $response = $this->getJson('/api/tasks?per_page=2&page=2')->assertOk();

        $this->assertCount(2, $response->json('data'));
        $response->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('meta.last_page', 3);
    }

    public function test_it_rejects_invalid_pagination_params(): void
    {
        $this->getJson('/api/tasks?per_page=0')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
        $this->getJson('/api/tasks?per_page=abc')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
        $this->getJson('/api/tasks?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
        $this->getJson('/api/tasks?page=0')->assertStatus(422)->assertJsonValidationErrors(['page']);
    }

    public function test_the_order_is_stable_after_editing_a_task(): void
    {
        $tasks = Task::factory()->count(4)->create();
        $expected = $tasks->pluck('id')->sort()->values()->all();

        $this->putJson("/api/tasks/{$tasks->first()->id}", ['title' => 'Editada'])->assertOk();

        $ids = array_column($this->getJson('/api/tasks')->assertOk()->json('data'), 'id');

        $this->assertSame($expected, $ids);
    }

    public function test_it_does_not_run_one_query_per_task(): void
    {
        Task::factory()->count(6)->create();

        DB::enableQueryLog();
        $this->getJson('/api/tasks')->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        // 1 consulta de tareas + 1 de usuarios (carga ansiosa), sin importar cuántas tareas haya.
        $this->assertLessThanOrEqual(2, $queries);
    }

    public function test_search_is_case_insensitive_and_treats_wildcards_as_text(): void
    {
        Task::factory()->create(['title' => 'Meta del 100% cumplida']);
        Task::factory()->create(['title' => 'Revisar el LOGIN']);
        Task::factory()->create(['title' => 'Otra tarea cualquiera']);

        $byCase = array_column($this->getJson('/api/tasks?search=login')->assertOk()->json('data'), 'title');
        $this->assertSame(['Revisar el LOGIN'], $byCase);

        $byWildcard = array_column($this->getJson('/api/tasks?search=%25')->assertOk()->json('data'), 'title');
        $this->assertSame(['Meta del 100% cumplida'], $byWildcard);
    }

    public function test_it_rejects_a_malformed_search_instead_of_failing_with_500(): void
    {
        $this->getJson('/api/tasks?search[]=x')->assertStatus(422)->assertJsonValidationErrors(['search']);
        $this->getJson('/api/tasks?status=banana')->assertStatus(422)->assertJsonValidationErrors(['status']);
    }
}
