<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Task;
use App\Models\TaskHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    private const DEFAULT_PER_PAGE = 15;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(Task::STATUSES)],
            'priority' => ['nullable', Rule::in(Task::PRIORITIES)],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        // Carga ansiosa: 1 consulta para las tareas + 1 para los usuarios,
        // en lugar de una consulta de usuario por cada tarea (N+1).
        $query = Task::query()->with('assignedUser');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->input('priority'));
        }

        $search = trim((string) $request->input('search', ''));

        if ($search !== '') {
            // LOWER + LIKE funciona igual en PostgreSQL y en SQLite (tests).
            // Se escapan % y _ para que se busquen como texto literal.
            $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search));
            $query->whereRaw("LOWER(title) LIKE ? ESCAPE '!'", ['%'.$escaped.'%']);
        }

        // Orden estable y determinista: no depende del orden físico de las filas
        // (que cambia al editar una fila en PostgreSQL).
        $query->orderBy('id');

        // Paginación opcional: si no se pide, la respuesta es la de siempre
        // ({ data: [...] }) y el frontend actual sigue funcionando.
        if ($request->filled('page') || $request->filled('per_page')) {
            $perPage = (int) ($request->input('per_page') ?: self::DEFAULT_PER_PAGE);
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data' => $paginator->getCollection()
                    ->map(fn (Task $task) => $this->formatTask($task))
                    ->values(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                ],
            ]);
        }

        return response()->json([
            'data' => $query->get()
                ->map(fn (Task $task) => $this->formatTask($task))
                ->values(),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $task = $this->findTask($id);

        if (! $task) {
            return $this->notFound();
        }

        return response()->json([
            'data' => $this->formatTask($task, true),
        ]);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        // refresh() trae los valores por defecto de la base (estado, prioridad).
        $task = Task::create($request->validated())->refresh();

        return response()->json([
            'data' => $this->formatTask($task),
        ], 201);
    }

    public function update(UpdateTaskRequest $request, string $id): JsonResponse
    {
        $task = $this->findTask($id);

        if (! $task) {
            return $this->notFound();
        }

        // validated() solo trae campos permitidos: el cliente no puede escribir
        // created_at, completed_at ni ningún otro campo que administra el servidor.
        $this->applyChanges($task, $request->validated());

        return response()->json([
            'data' => $this->formatTask($task),
        ]);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $task = $this->findTask($id);

        if (! $task) {
            return $this->notFound();
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(Task::STATUSES)],
        ]);

        $this->applyChanges($task, ['status' => $validated['status']]);

        return response()->json([
            'data' => $this->formatTask($task),
        ]);
    }

    /**
     * Guarda los cambios de la tarea y, si pasó a "finalizada", su fecha de
     * finalización y su entrada de historial, todo en UNA sola transacción:
     * si falla cualquier parte, no queda nada guardado a medias.
     * Si la tarea sale del estado "finalizada" (se reabre), se limpia la fecha
     * de finalización: una tarea abierta no puede figurar como finalizada.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function applyChanges(Task $task, array $attributes): void
    {
        $previousStatus = $task->status;

        DB::transaction(function () use ($task, $attributes, $previousStatus) {
            $task->fill($attributes);

            $becameCompleted = $task->status === 'completed' && $previousStatus !== 'completed';
            $wasReopened = $previousStatus === 'completed' && $task->status !== 'completed';

            if ($becameCompleted) {
                $task->completed_at = now();
            }

            if ($wasReopened) {
                $task->completed_at = null;
            }

            $task->save();

            if ($becameCompleted) {
                TaskHistory::create([
                    'task_id' => $task->id,
                    'from_status' => $previousStatus,
                    'to_status' => $task->status,
                    'note' => 'Tarea marcada como finalizada',
                ]);
            }
        });
    }

    /**
     * Un id que no es un entero válido nunca puede existir: se responde 404
     * sin consultar la base (evita un error 500 de PostgreSQL con "abc").
     */
    private function findTask(string $id): ?Task
    {
        if (! ctype_digit($id) || strlen($id) > 18) {
            return null;
        }

        return Task::find($id);
    }

    private function notFound(): JsonResponse
    {
        return response()->json([
            'message' => 'Tarea no encontrada',
        ], 404);
    }

    private function formatTask(Task $task, bool $withHistory = false): array
    {
        $assignedUser = $task->assignedUser;

        $payload = [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'priority' => $task->priority,
            'due_date' => $task->due_date?->format('Y-m-d'),
            'assigned_user_id' => $task->assigned_user_id,
            'assigned_user' => $assignedUser ? [
                'id' => $assignedUser->id,
                'name' => $assignedUser->name,
            ] : null,
            'completed_at' => $task->completed_at?->toIso8601String(),
            'created_at' => $task->created_at?->toIso8601String(),
            'updated_at' => $task->updated_at?->toIso8601String(),
        ];

        if ($withHistory) {
            $payload['histories'] = $task->histories()
                ->orderBy('created_at')
                ->orderBy('id')
                ->get()
                ->map(fn (TaskHistory $history) => [
                    'id' => $history->id,
                    'from_status' => $history->from_status,
                    'to_status' => $history->to_status,
                    'note' => $history->note,
                    'created_at' => $history->created_at?->toIso8601String(),
                ])
                ->values();
        }

        return $payload;
    }
}
