<?php

namespace Tests\Feature;

use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskStoreValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_rejects_an_unknown_status_and_priority(): void
    {
        $this->postJson('/api/tasks', ['title' => 'prueba', 'status' => 'banana', 'priority' => 'urgente'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status', 'priority']);

        $this->assertDatabaseCount('tasks', 0);
    }

    public function test_it_rejects_a_date_with_another_format_instead_of_failing_with_500(): void
    {
        $this->postJson('/api/tasks', ['title' => 'prueba', 'due_date' => '31/12/2030'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['due_date']);
    }

    public function test_it_rejects_a_title_that_is_too_long(): void
    {
        $this->postJson('/api/tasks', ['title' => str_repeat('a', 256)])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_it_rejects_a_description_that_is_too_long(): void
    {
        $this->postJson('/api/tasks', ['title' => 'prueba', 'description' => str_repeat('a', 1001)])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['description']);
    }

    public function test_it_rejects_an_assigned_user_that_does_not_exist(): void
    {
        $this->postJson('/api/tasks', ['title' => 'prueba', 'assigned_user_id' => 999999])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['assigned_user_id']);
    }

    public function test_it_rejects_a_title_made_only_of_spaces(): void
    {
        $this->postJson('/api/tasks', ['title' => '     '])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_it_trims_the_title_and_stores_empty_optional_fields_as_null(): void
    {
        $this->postJson('/api/tasks', [
            'title' => '   Tarea con espacios   ',
            'description' => '',
            'due_date' => '',
            'assigned_user_id' => '',
        ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Tarea con espacios')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.priority', 'medium')
            ->assertJsonPath('data.due_date', null);

        $this->assertDatabaseHas('tasks', ['title' => 'Tarea con espacios']);
        $this->assertSame(1, Task::count());
    }
}
