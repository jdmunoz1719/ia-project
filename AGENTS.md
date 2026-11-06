# Frontend · Reglas técnicas

Complementa el `AGENTS.md` de la raíz (que manda en cómo trabajar). Qué construir está en `docs/contexto-prototipo.md`.

## Stack

| Tema | Decisión |
|---|---|
| Base | React 19 + Vite 8 + TypeScript 7 en modo `strict` |
| Estilos | Tailwind CSS v4 con tokens en `src/index.css` (`:root`); shadcn/ui estilo `base-nova` sobre **Base UI** (no Radix: se usa `render={...}` en lugar de `asChild`) |
| Íconos | lucide-react |
| Rutas | React Router 7 |
| Estado | Zustand con `persist` en `localStorage` (**solo** lo usan los servicios mock) |
| Formularios | Inputs controlados; react-hook-form + zod disponibles para formularios grandes |
| Gráficas | Recharts |
| Fechas | date-fns (locale `es`) |
| Pruebas | Vitest (lógica de dominio e IA simulada) |
| Lint | oxlint |
| Despliegue | Vercel (build estático con reescritura de rutas a `index.html`) |

Cuando exista backend (NestJS): `services/http` reemplaza a `services/mock` cumpliendo el tipo `Api` de `services/api.ts`, y las consultas pasan a TanStack Query. No se adelanta antes.

## Capas

```
src/
  domain/      Lógica pura (sin React): motor contable, indicadores, amortización, agenda. Con pruebas.
  services/    api.ts = único punto de entrada de las pantallas. mock/ = implementación actual. ia/ = IA simulada.
  store/       Estado persistido. Solo lo importan los servicios mock.
  data/        Datos semilla.
  hooks/       useConsulta (consulta + recarga al cambiar datos), useSesion.
  components/  Compartidos: comunes, paneles (drill-down → movimiento → soporte), Layout, Cargador. ui/ = shadcn.
  features/    Una carpeta por pantalla.
  lib/         format.ts (formatos colombianos), utils.ts.
```

**Reglas:**
- Las pantallas **solo** importan `@/services/api`, nunca `store/` ni `services/mock/` directamente. (Excepción documentada: `useSesion` lee la sesión de forma síncrona para guardas de ruta.)
- Los servicios devuelven `Promise` y simulan latencia de 200 a 600 ms; la IA simulada, de 1,5 a 3 s.
- **Ninguna cifra se calcula en un componente.** Todo sale de `domain/`.
- Los permisos por rol se verifican en los servicios (`exigir(...)`), además de ocultar o desactivar botones.
- Los `select` son nativos (`Selector` en `components/comunes.tsx`) y solo ofrecen valores de la configuración.
- Montos con `Money` / `formatCOP`; fechas con `Fecha` / `formatFecha` e `InputFecha` (siempre `dd/mm/aaaa`).

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run test     # Vitest
npm run lint     # oxlint
npm run build    # typecheck (tsc -b) + build de Vite
```
