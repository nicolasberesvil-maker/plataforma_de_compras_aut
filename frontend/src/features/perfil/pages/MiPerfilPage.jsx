import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usuariosApi } from '../../usuarios/api/usuarios.api';
import { useAuthStore } from '../../../store/authStore';

const datosSchema = z.object({
  nombre: z.string().min(2, 'Requerido'),
  apellido: z.string().min(2, 'Requerido'),
  telefono: z.string().optional()
});

const passwordSchema = z.object({
  passwordActual: z.string().min(1, 'Requerido'),
  passwordNueva: z.string().min(8, 'Mínimo 8 caracteres')
});

export function MiPerfilPage() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const usuarioSesion = useAuthStore((s) => s.usuario);

  // GET /auth/me solo devuelve lo que trae el JWT (id, email, rol) — para
  // nombre/apellido/teléfono hace falta el perfil completo de /usuarios/:id.
  const { data, isLoading } = useQuery({
    queryKey: ['usuarios', usuarioSesion?.id],
    queryFn: () => usuariosApi.obtener(usuarioSesion.id),
    enabled: !!usuarioSesion?.id
  });
  const usuario = data?.usuario;

  const datosForm = useForm({
    resolver: zodResolver(datosSchema),
    values: usuario ? { nombre: usuario.nombre, apellido: usuario.apellido, telefono: usuario.telefono || '' } : undefined
  });

  const actualizarDatos = useMutation({
    mutationFn: (datos) => usuariosApi.actualizar(usuario.id, datos),
    onSuccess: (res) => setAuth(accessToken, { ...usuario, ...res.usuario })
  });

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  const cambiarPassword = useMutation({
    mutationFn: (datos) => usuariosApi.cambiarPassword(usuario.id, datos),
    onSuccess: () => passwordForm.reset()
  });

  if (isLoading || !usuario) return <p className="p-4 text-gray-500 text-sm">Cargando...</p>;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h2 className="text-lg font-bold">Mi perfil</h2>

      <form
        onSubmit={datosForm.handleSubmit((datos) => actualizarDatos.mutate(datos))}
        className="bg-white border rounded-lg p-4 space-y-3"
      >
        <h3 className="font-medium">Datos personales</h3>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input {...datosForm.register('nombre')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Apellido</label>
          <input {...datosForm.register('apellido')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input {...datosForm.register('telefono')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        {actualizarDatos.isSuccess && <p className="text-aut-verde text-sm">Datos actualizados.</p>}

        <button
          type="submit"
          disabled={actualizarDatos.isPending}
          className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Guardar
        </button>
      </form>

      <form
        onSubmit={passwordForm.handleSubmit((datos) => cambiarPassword.mutate(datos))}
        className="bg-white border rounded-lg p-4 space-y-3"
      >
        <h3 className="font-medium">Cambiar contraseña</h3>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña actual</label>
          <input type="password" {...passwordForm.register('passwordActual')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {passwordForm.formState.errors.passwordActual && (
            <p className="text-red-600 text-xs mt-1">{passwordForm.formState.errors.passwordActual.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña nueva</label>
          <input type="password" {...passwordForm.register('passwordNueva')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {passwordForm.formState.errors.passwordNueva && (
            <p className="text-red-600 text-xs mt-1">{passwordForm.formState.errors.passwordNueva.message}</p>
          )}
        </div>

        {cambiarPassword.isError && (
          <p className="text-red-600 text-sm">
            {cambiarPassword.error.response?.data?.error?.message || 'Error al cambiar la contraseña'}
          </p>
        )}
        {cambiarPassword.isSuccess && <p className="text-aut-verde text-sm">Contraseña actualizada.</p>}

        <button
          type="submit"
          disabled={cambiarPassword.isPending}
          className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Cambiar contraseña
        </button>
      </form>
    </div>
  );
}
