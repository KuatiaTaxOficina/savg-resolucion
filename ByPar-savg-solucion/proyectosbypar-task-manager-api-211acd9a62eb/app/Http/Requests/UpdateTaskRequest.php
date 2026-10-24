<?php

namespace App\Http\Requests;

/**
 * Mismas reglas que al crear, pero el título es opcional: si viene, no puede
 * estar vacío. Los campos que administra el servidor (created_at,
 * completed_at, id) no están en las reglas, por lo que validated() los descarta.
 */
class UpdateTaskRequest extends StoreTaskRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
        ]);
    }
}
