import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function StudentsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const students = useQuery({
    queryKey: ['students'],
    queryFn: async () => (await api.listStudents()).students,
  });

  const create = useMutation({
    mutationFn: () => api.createStudent(name, email || undefined),
    onSuccess: () => {
      setName('');
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {(students.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-slate-500">{s.email ?? 'No email'}</p>
              </div>
            </li>
          ))}
          {!students.isLoading && (students.data?.length ?? 0) === 0 && (
            <li className="px-4 py-8 text-center text-slate-500">No students yet.</li>
          )}
        </ul>
      </div>
      <form onSubmit={onSubmit} className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Add student</h2>
        <label className="mt-4 block text-sm">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          Email (optional)
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Create
        </button>
      </form>
    </div>
  );
}
