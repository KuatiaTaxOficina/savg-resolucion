<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskCompletionAtomicityTest extends TestCase
{
    use RefreshDatabase;

    private function breakHistoryWrites(): void
    {
        // Simula un incidente en la base: falla la escritura del historial.
        TaskHistory::creating(function () {
            throw new \RuntimeException('Fallo simulado al escribir el historial');
        });
    }

    public function test_if_the_history_fails_the_status_endpoint_leaves_nothing_saved(): void
    {
        $task = Task::factory()->create(['status' => 'in_progress', 'completed_at' => null]);

        $this->breakHistoryWrites();

        $this->patchJson("/api/tasks/{$task->id}/status", ['status' => 'completed'])
            ->assertStatus(500);

        $task->refresh();

        $this->assertSame('in_progress', $task->status);
        $this->assertNull($task->completed_at);
        $this->assertDatabaseCount('task_histories', 0);
    }

    public function test_if_the_history_fails_the_update_endpoint_leaves_nothing_saved(): void
    {
        $task = Task::factory()->create(['title' => 'Original', 'status' => 'pending', 'completed_at' => null]);

        $this->breakHistoryWrites();

        $this->putJson("/api/tasks/{$task->id}", ['title' => 'Nuevo', 'status' => 'completed'])
            ->assertStatus(500);

        $task->refresh();

        $this->assertSame('Original', $task->title);
        $this->assertSame('pending', $task->status);
        $this->assertNull($task->completed_at);
        $this->assertDatabaseCount('task_histories', 0);
    }

    public function test_completing_a_task_through_update_records_history_and_date(): void
    {
        $task = Task::factory()->create(['status' => 'pending', 'completed_at' => null]);

        $this->putJson("/api/tasks/{$task->id}", ['status' => 'completed'])->assertOk();

        $task->refresh();

        $this->assertSame('completed', $task->status);
        $this->assertNotNull($task->completed_at);
        $this->assertDatabaseHas('task_histories', [
            'task_id' => $task->id,
            'from_status' => 'pending',
            'to_status' => 'completed',
        ]);
    }

    public function test_an_already_completed_task_does_not_get_a_second_history_entry(): void
    {
        $task = Task::factory()->create(['status' => 'completed', 'completed_at' => now()]);

        $this->patchJson("/api/tasks/{$task->id}/status", ['status' => 'completed'])->assertOk();

        $this->assertDatabaseCount('task_histories', 0);
    }
}
