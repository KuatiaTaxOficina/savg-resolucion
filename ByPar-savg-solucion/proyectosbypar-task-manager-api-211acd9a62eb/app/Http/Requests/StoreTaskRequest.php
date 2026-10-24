<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * La API no recorta espacios ni convierte "" en null (ver bootstrap/app.php),
     * así que se normaliza acá, antes de validar: el servidor es la última
     * barrera aunque el cliente no pase por el formulario web.
     */
    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (['title', 'description', 'due_date'] as $field) {
            $value = $this->input($field);

            if (is_string($value)) {
                $normalized[$field] = trim($value);
            }
        }

        foreach (['description', 'due_date', 'assigned_user_id'] as $field) {
            $value = array_key_exists($field, $normalized) ? $normalized[$field] : $this->input($field);

            if ($value === '') {
                $normalized[$field] = null;
            }
        }

        $this->merge($normalized);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', Rule::in(Task::STATUSES)],
            'priority' => ['sometimes', Rule::in(Task::PRIORITIES)],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ];
    }
}
