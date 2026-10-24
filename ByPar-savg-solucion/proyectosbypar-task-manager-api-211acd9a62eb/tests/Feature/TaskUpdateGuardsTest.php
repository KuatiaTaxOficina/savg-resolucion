<?php

namespace Tests\Feature;

use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskUpdateGuardsTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_an_unknown_task_returns_404(): void
    {
        $this->putJson('/api/tasks/999999', ['title' => 'no existe'])
            ->assertNotFound();
    }

    public function test_changing_the_status_of_an_unknown_task_returns_404(): void
    {
        $this->patchJson('/api/tasks/999999/status', ['status' => 'completed'])
            ->assertNotFound();
    }

    public function test_a_non_numeric_id_returns_404_instead_of_500(): void
    {
        $this->getJson('/api/tasks/abc')->assertNotFound();
        $this->putJson('/api/tasks/abc', ['title' => 'x'])->assertNotFound();
    }

    public function test_the_client_cannot_write_fields_managed_by_the_server(): void
    {
        $task = Task::factory()->create(['status' => 'pending', 'completed_at' => null]);
        $createdAt = $task->fresh()->created_at;

        $this->putJson("/api/tasks/{$task->id}", [
            'title' => 'Título nuevo',
            'created_at' => '1999-01-01 00:00:00',
            'completed_at' => '2030-01-01 00:00:00',
        ])->assertOk();

        $task->refresh();

        $this->assertSame('Título nuevo', $task->title);
        $this->assertNull($task->completed_at);
        $this->assertTrue($createdAt->equalTo($task->created_at));
    }

    public function test_it_rejects_invalid_data_on_update(): void
    {
        $task = Task::factory()->create();

        $this->putJson("/api/tasks/{$task->id}", ['title' => 'ok', 'status' => 'banana', 'due_date' => '31/12/2030'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status', 'due_date']);
    }

    public function test_it_rejects_an_empty_title_on_update(): void
    {
        $task = Task::factory()->create(['title' => 'Título original']);

        $this->putJson("/api/tasks/{$task->id}", ['title' => '   '])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);

        $this->assertSame('Título original', $task->fresh()->title);
    }
}
