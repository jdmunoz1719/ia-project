# Contexto del prototipo · Control Financiero Multiempresa (Caja Clara)

> Fuente funcional del prototipo. Las reglas de trabajo (agentes, git, pruebas, PROGRESS) están en `AGENTS.md` de la raíz y de `frontend/`. Si este documento y `AGENTS.md` se contradicen en cómo trabajar, manda `AGENTS.md`; en qué construir, manda este documento.

## 1. Qué es y para qué

Prototipo **solo frontend** de una plataforma web que controla la parte administrativa y financiera de hasta 5 empresas de un mismo grupo, más los "asuntos personales" de los socios.

Su único objetivo es **ganar una licitación**. Se va a mostrar en una demo corta al cliente, así que debe:

- verse profesional y sentirse como un producto real, no como un mockup;
- demostrar el flujo central: **cargar → la IA propone → el usuario aprueba → ver y decidir**;
- reproducir **exactamente** los tres ejemplos del anexo del cliente (sección 9), que son los que van a probar en la demo.

No hay backend. Todo funciona con datos mock y una "IA simulada". Sin embargo, el código debe quedar listo para conectarse después a un backend en **NestJS** sin reescribir las pantallas.

### El problema del cliente (para entender el tono)

- Hoy todo pasa por WhatsApp y Excel.
- Una empresa paga gastos de otra y no queda claro cuánto se deben entre ellas.
- Cerrar el mes es lento.
- Las cuotas de los créditos, los arriendos y los impuestos dependen de que alguien se acuerde.

---

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Base contable | **Caja**: solo se registra lo que entra o sale efectivamente. No hay cuentas por cobrar ni por pagar con terceros. |
| Gastos repartidos | **Sí.** Un gasto se puede repartir entre varias empresas, por porcentaje o por valor. |
| Asuntos personales | **Una sola entidad**, "Asuntos personales", que se trata como una empresa más. |
| Usuarios y roles | **Simulados** (decisión del 06/11/2026). Login falso con verificación en dos pasos (código de demo) y tres usuarios: Administrador (todo), Asistente (carga y corrige, no aprueba) y Contador (solo consulta e informes de las Empresas A y B). Un selector en el menú de usuario cambia de rol. No hay seguridad real: es solo para mostrar el punto 3.13 y 5 del pliego. |
| Nombre y marca | **Caja Clara**, acento azul petróleo. Se cambia en `NOMBRE_APP` y en los tokens de `src/index.css`. |
| Trato | La interfaz trata al usuario de **tú**. |
| Despliegue | URL pública en **Vercel**. El proyecto queda listo (`vercel.json`) y David despliega con su cuenta. |
| Archivos de ejemplo | Ficticios, generados por el equipo (imagen, PDF, Excel, audio, .eml, chat .txt). |
| WhatsApp | Entra de las dos formas: chat exportado (.txt) y un número conectado. En el prototipo, el número conectado se **simula**: los mensajes "llegan" a la bandeja. |
| Moneda | Solo COP, en pesos enteros, sin centavos. |
| Datos | Mocks en memoria, persistidos en `localStorage`, con un botón "Reiniciar demo". |

---

## 3. Stack

- **React 19 con Vite 8 y TypeScript 7** (en modo `strict`).
- **Tailwind CSS v4 con shadcn/ui** (estilo `base-nova`, sobre Base UI, no Radix) para los componentes e **iconos lucide-react**. Los `select` son nativos con estilo (funcionan mejor en celular).
- **Recharts** para las gráficas.
- **React Router** para la navegación.
- **Zustand** para el estado, con el middleware `persist` en `localStorage`.
- **react-hook-form con zod** para los formularios.
- **date-fns** con el locale `es`.
- **Vitest** para probar la lógica de dominio.

### Formatos colombianos (obligatorios en toda la app)

- **Dinero:** `$ 1.180.000`. Usar `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`, centralizado en `formatCOP()`.
- **Fechas:** `dd/mm/aaaa`.
- **Porcentajes:** coma decimal, por ejemplo `1,1348 %`.
- Toda la interfaz en español de Colombia.

---

## 4. Arquitectura del frontend

```
src/
  domain/        # Tipos y lógica PURA (sin React): motor contable, amortización, intercompañías, indicadores
  services/      # Interfaces de acceso a datos + implementación mock
    api.ts       #   interfaces (IMovimientosService, IBandejaService, ...)
    mock/        #   implementación con el store + datos semilla
    ia/          #   "IA simulada": extractor de propuestas
  store/         # Zustand (estado persistido)
  data/seed.ts   # Datos semilla
  features/      # Una carpeta por módulo: inicio, bandeja, movimientos, intercompanias, tableros, creditos, cierres, agenda, chat, informes, configuracion
  components/    # Componentes compartidos (Money, FechaCO, DrillDown, BadgeEstado, ...)
  lib/format.ts  # formatCOP, formatFecha, formatPct
```

### Reglas de arquitectura

- Las pantallas **solo** hablan con `services/`, nunca directamente con el store ni con los mocks. Así, el día que exista NestJS se reemplaza `services/mock` por `services/http` y nada más cambia.
- Los servicios devuelven `Promise`, aunque sean mocks, y simulan latencia de 200 a 600 ms. La IA simulada tarda entre 1,5 y 3 s.
- **Ninguna cifra se calcula en un componente.** Todo sale de `domain/`, que es lo mismo que en el producto real hará el backend.

---

## 5. Reglas de negocio que nunca se rompen

1. **Lo que propone la IA no afecta saldos ni informes** hasta que el usuario lo aprueba.
2. **Cada hecho se registra una sola vez**, aunque afecte a dos o más empresas.
3. **Desde cualquier cifra se llega al detalle**: la cifra lleva a los movimientos que la forman y cada movimiento lleva a su soporte original.
4. **El archivo o mensaje original se guarda sin modificarse.**
5. **Las cifras las calcula el sistema, no la IA.** La IA solo lee y propone.
6. **La IA solo asigna empresas, cuentas, proyectos y terceros que existan en la configuración.** Si no reconoce uno, deja el campo vacío y la confianza baja.
7. **Un mes cerrado queda bloqueado.** Reabrirlo exige escribir un motivo, que queda en el historial.
8. **El historial de cambios no se puede borrar.**

---

## 6. Modelo de datos (tipos de dominio)

Los montos se manejan como `number`, en pesos enteros. Las fechas, como `string` ISO `yyyy-mm-dd`.

```ts
type Entidad = { id; nombre; alias: string[]; esPersonal: boolean }   // Empresas A–E + "Asuntos personales"
type Cuenta = { id; entidadId; banco; nombre; alias: string[]; saldoInicial; fechaSaldoInicial }
type Proyecto = { id; entidadId; nombre }
type Categoria = { id; nombre; clase: 'ingreso' | 'costo_venta' | 'gasto_operativo' | 'financiero' | 'inversion' }
type Tercero = { id; nombre; alias: string[] }

type TipoHecho =
  | 'ingreso' | 'costo' | 'gasto' | 'interes' | 'inversion_proyecto'
  | 'traslado'            // entre cuentas
  | 'pago_intercompania'  // devolución o pago de deuda entre empresas
  | 'desembolso_credito' | 'pago_credito'

// Un "Hecho" es lo que el usuario aprueba. Se registra UNA vez.
type Hecho = {
  id; tipo: TipoHecho; fecha; monto; descripcion;
  cuentaOrigenId?; cuentaDestinoId?;     // de dónde sale o a dónde entra la plata
  entidadPagadoraId;                     // dueña de la cuenta
  asignaciones: { entidadId; proyectoId?; monto }[];  // a quién pertenece el gasto o ingreso (puede ser repartido)
  categoriaId?; terceroId?; creditoId?;
  desglosePagoCredito?: { capital; interes; cargos };
  soporteIds: string[]; origenBandejaId?;
  aprobadoPor; aprobadoEn;
}

// Derivados que calcula domain/ a partir de los Hechos:
type LineaLibro = { hechoId; entidadId; cuentaId?; concepto: 'caja' | 'resultado' | 'por_cobrar_ic' | 'por_pagar_ic' | 'credito'; monto; claseResultado? }

type Soporte = { id; nombre; tipoMime; tamano; contenidoTexto?; urlMock; recibidoEn; canal: 'manual' | 'whatsapp' | 'whatsapp_export' | 'correo' | 'drive'; hash }

type ItemBandeja = {
  id; soporteId; estado: 'pendiente' | 'procesando' | 'revisado';
  propuestas: Propuesta[]; recibidoEn; canal;
}
type Propuesta = {
  id; tipo: TipoHecho | 'tarea';
  campos: Partial<Hecho> & { tituloTarea?; vence? };
  confianza: number;          // 0–100
  evidencia: { campo; textoFuente; inicio; fin }[];   // fragmento del original de donde salió cada dato
  estado: 'pendiente' | 'aprobada' | 'corregida' | 'descartada' | 'rechazada' | 'duplicado';
  posibleDuplicadoDe?: string;
}

type Credito = {
  id; banco; entidadId; monto; tasa: { valor; tipo: 'EA' | 'MV' };
  numCuotas; primeraFecha; cargosPorCuota; nombre;   // p. ej. "Crédito constructor"
  pagos: { hechoId; numeroCuota; capital; interes; cargos; fecha }[];
  saldosBanco: { fecha; saldo }[];
  cambios: { fecha; tipo: 'tasa' | 'abono_extra'; valor; nota }[];
}

type Obligacion = { id; nombre; entidadId; valor; diaVencimiento | fecha; recurrencia: 'mensual' | 'bimestral' | 'anual' | 'unica'; responsable; cumplidaPorHechoId? }
type Tarea = { id; titulo; vence; entidadId?; origenPropuestaId?; hecha: boolean }
type Cierre = { entidadId; cuentaId; mes: 'yyyy-mm'; saldoSistema; saldoExtracto; diferencias: { monto; explicacion }[]; estado: 'abierto' | 'publicado'; reaperturas: { fecha; motivo }[] }
type EventoHistorial = { fecha; usuario; accion; objeto; detalle }   // solo se agregan, nunca se borran
```

---

## 7. Lógica de dominio (`src/domain/`), con pruebas en Vitest

### 7.1 Motor contable (base caja)

Cada `Hecho` aprobado se expande en `LineaLibro[]`. Ninguna pantalla lee `Hecho` para calcular; todas leen las líneas.

**Gasto pagado por la misma empresa:** caja de la empresa (−) y resultado de la empresa (−, en su clase).

**Gasto que la Empresa B paga por la Empresa A** (el pagador es distinto del dueño):

- Caja de B: −monto.
- Resultado de A: −monto (es gasto de A).
- B anota una cuenta por cobrar intercompañía a A: +monto.
- A anota una cuenta por pagar intercompañía a B: +monto.
- B **no** registra ningún gasto.

**Gasto repartido** (el pagador cubre todo y hay varias asignaciones): cada entidad asignada registra su parte como gasto. Por cada parte que no es del pagador se genera una deuda intercompañía hacia el pagador.

**Pago intercompañía o devolución** (A le devuelve a B):

- Caja de A: −monto.
- Caja de B: +monto.
- Se cancelan la cuenta por cobrar y la cuenta por pagar.
- No afecta el resultado de ninguna de las dos.

**Otros tipos:**

- **Inversión en proyecto:** sale caja, pero **no** es gasto. Va al indicador "Inversión en proyectos".
- **Traslado:** es caja contra caja. No afecta el resultado.
- **Desembolso de crédito:** entra caja y sube la deuda. No es ingreso.
- **Pago de crédito:**
  - el capital baja la deuda;
  - el interés y los cargos van como "financiero" en el resultado;
  - la caja baja por el total.

**Vista de grupo:** suma todas las entidades y **elimina** las líneas `por_cobrar_ic` y `por_pagar_ic`. Los pagos intercompañía no cuentan como entrada ni salida del grupo. El gasto aparece una sola vez. Hay un interruptor para incluir o excluir los "Asuntos personales".

### 7.2 Indicadores (base caja, con filtro por entidad, proyecto, grupo y rango de fechas)

- **Ingresos.**
- **Utilidad bruta** = ingresos − costo de ventas.
- **Resultado operativo** = utilidad bruta − gastos operativos.
- **Resultado final** = resultado operativo − intereses y cargos financieros.
- **Flujo de caja** = entradas − salidas (de caja).
- **Inversión en proyectos.**
- **Saldo de caja y bancos** = saldo inicial + movimientos.

Cada indicador devuelve `{ valor, lineas: LineaLibro[], pendientesPorAprobar: number }`. El campo `lineas` es lo que alimenta el detalle al hacer clic. Si `pendientesPorAprobar > 0`, la interfaz muestra un aviso como "2 por aprobar".

En la interfaz, los indicadores llevan una nota pequeña que dice "base caja".

### 7.3 Amortización de créditos (cuota fija)

- **Tasa mensual:** `i = (1 + EA)^(1/12) − 1` si la tasa viene en EA. Si viene en MV, se usa directamente. Se calcula con la tasa **sin redondear** y se muestra con 4 decimales.
- **Cuota financiera:** `round(P · i / (1 − (1+i)^−n))`.
- **Por cada periodo:**
  - interés = `round(saldo · i)`;
  - capital = cuota − interés;
  - saldo −= capital.
- **Última cuota:** el capital es igual al saldo restante, para que cierre exactamente en $0. Es normal que la última cuota difiera unos pocos pesos.
- **Cargos fijos:** se suman aparte. Cuota total = cuota financiera + cargos.
- **Cuota vencida:** la fecha ya pasó (respecto a "hoy" en la demo) y no hay pago registrado. Genera una alerta.
- **Saldo real vs. saldo según la tabla:** el real se calcula a partir de los pagos registrados.

**Prueba obligatoria** (el Ejemplo 3 del cliente): crédito de $60.000.000, 14,5 % EA, 24 cuotas, cargos de $45.000 por cuota y primera cuota el 05/09/2026.

| Dato | Valor esperado |
|---|---|
| Tasa mensual | 1,1348 % |
| Cuota financiera | $ 2.869.933 |
| Cuota total (con cargos) | $ 2.914.933 |
| Cuota 1: capital | $ 2.189.076 |
| Cuota 1: interés | $ 680.857 |
| Cuota 1: cargos | $ 45.000 |
| Saldo después de la cuota 1 | $ 57.810.924 |
| Cuota 2: interés | $ 656.016 |
| Cuota 2: capital | $ 2.213.917 |
| Saldo después de la cuota 24 | $ 0 (cuota 24: capital $ 2.837.730, interés $ 32.201) |

> Ojo: el cliente llama "cuota" a $2.914.933, que ya incluye los cargos. En la interfaz se muestran ambas: **"Cuota $ 2.914.933 (financiera $ 2.869.933 + cargos $ 45.000)"**.

### 7.4 Pruebas obligatorias del Ejemplo 2 (pagos entre empresas)

La Empresa B paga $2.350.000 del arriendo de la Empresa A desde su propia cuenta.

- A tiene un gasto de $2.350.000.
- B **no** tiene gasto, pero su cuenta baja $2.350.000.
- A le debe $2.350.000 a B.
- En la vista de grupo, el gasto aparece una vez y la deuda interna no aparece.
- Cuando A le devuelve el dinero a B, la deuda queda en $0.

Agregar también una prueba de gasto repartido. Por ejemplo, un arriendo de $3.000.000 pagado por A, con 50 % para A y 50 % para C: C le debe $1.500.000 a A y el grupo muestra un solo gasto de $3.000.000.

---

## 8. "IA simulada" (`src/services/ia/`)

Debe sentirse real en la demo. Se implementa en dos capas.

### Capa 1: extractor por reglas (funciona con texto libre)

- **Montos:** `2.350.000`, `$2.350.000`, `2,35 millones`, `1.18 millones`, `350 mil`.
- **Fechas relativas a la fecha de recepción:** "hoy", "ayer", "antier", "mañana", "pasado mañana", "el 5" (el día 5 del mes actual o del siguiente), "el lunes", "dd/mm" y "dd/mm/aaaa".
- **Entidades, cuentas, proyectos y terceros:** se reconocen por nombre o **alias** de la configuración. Ejemplos: "Bancolombia" → la cuenta Bancolombia de la entidad mencionada; "Banco B"; "la bodega" → proyecto o tercero si existe el alias.
- **Tipo de movimiento por palabras clave:**
  - "pagué", "pago", "gasté" → gasto;
  - "recibí", "nos consignaron", "cobré" → ingreso;
  - "pasé", "trasladé" → traslado;
  - "cuota del crédito" → pago de crédito;
  - "hay que", "toca", "mañana pagar" → tarea.
- **Categoría por palabra clave:** nómina, arriendo, servicios, IVA, etc.
- **Varias propuestas por mensaje:** se separa por oraciones y conectores ("y", "además", ".").
- **Pagos intercompañía:** si la entidad pagadora (dueña de la cuenta) es distinta de la entidad a la que pertenece el gasto, la propuesta se marca como intercompañía y se muestra el efecto antes de aprobar.
- **Evidencia:** por cada campo se guarda el fragmento exacto del texto (posición de inicio y fin) para resaltarlo en la interfaz.
- **Confianza:**
  - parte de 95 %;
  - baja 20 por cada campo clave faltante (monto, fecha o entidad);
  - baja 10 por cada alias ambiguo.

### Capa 2: respuestas predefinidas para archivos

Para fotos, PDF, audio, Excel y .eml (en el prototipo no se hace OCR ni transcripción real), se usa un mapa `nombreArchivo/hash → { textoExtraido, propuestas }`. Los archivos de ejemplo van en `public/demo/` y se cargan con un clic desde un panel "Archivos de ejemplo":

- `recibo-arriendo-bodega.jpg`: foto de un recibo.
- `factura-servicios.pdf`.
- `nota-de-voz-taller.ogg`: muestra una "transcripción" y luego las propuestas.
- `chat-whatsapp-socios.txt`: chat exportado con 4 a 6 mensajes que generan varias propuestas, una de ellas duplicada.
- `extracto-bancolombia-oct.xlsx`.
- `correo-proveedor.eml`.

Si se sube un archivo que no está en el mapa, la "IA" responde con una sola propuesta de baja confianza y los campos vacíos, para que el usuario la complete. Así la demo no se rompe.

### Duplicados

Hay dos verificaciones:

- **Archivo repetido:** mismo hash.
- **Pago parecido:** mismo monto, misma entidad y fecha a ±3 días de un hecho aprobado.

En ambos casos aparece la etiqueta "Posible duplicado de…" con un enlace al original.

### WhatsApp conectado (simulado)

En el encabezado de la bandeja va un indicador "WhatsApp conectado · +57 3XX…". Hay un botón oculto (o el atajo `Ctrl+Shift+W`) que **inyecta un mensaje entrante** con animación, para la demo en vivo. Lo mismo para el correo, con "Correo conectado · bandeja@…".

---

## 9. Los tres ejemplos del cliente (guion de la demo)

Fecha "hoy" de la demo: configurable, por defecto **28/10/2026**.

**Ejemplo 1:** se pega un mensaje de WhatsApp recibido el 28/10/2026.

> "Ayer pagué 1.180.000 de la nómina del taller desde el Banco B de la Empresa A. Mañana hay que pagar la cuota del crédito constructor."

Debe producir exactamente dos propuestas pendientes:

1. **Gasto de nómina** de $ 1.180.000, con fecha 27/10/2026, Empresa A y cuenta Banco B. Si existe el proyecto "Taller", se asigna.
2. **Tarea** "Pagar cuota del crédito constructor", con vencimiento el 29/10/2026 y vínculo al crédito constructor.

**Ejemplo 2:** pagos entre empresas, como se describe en el punto 7.4. El usuario escribe en la pantalla de inicio:

> "Pagué 2.350.000 de arriendo de la bodega desde Bancolombia de la Empresa B"

Para que el caso se dé, la bodega está configurada como de la Empresa A. La propuesta muestra la vista previa del efecto:

- "Gasto en Empresa A";
- "Sale de Bancolombia (Empresa B)";
- "Empresa A quedará debiendo $ 2.350.000 a Empresa B".

**Ejemplo 3:** el crédito descrito en el punto 7.3. Debe verse:

- la tabla de amortización completa;
- la cuota 1 pagada;
- la cuota 2 **vencida**, con alerta roja;
- el saldo final en $0.

---

## 10. Pantallas

La navegación va en un sidebar con: **Inicio, Bandeja, Movimientos, Entre empresas, Tableros, Créditos, Cierres, Agenda, Chat, Informes, Configuración**. En la barra superior va un selector global "Ver: Grupo / Empresa A … / Asuntos personales".

Debe ser responsive. En celular, el inicio y la bandeja tienen que funcionar bien para cargar fotos y audios: captura de cámara con `<input capture>` y grabación de voz simulada.

### Alcance completo (son el corazón de la demo)

**Inicio**

- Cuadro grande "¿Qué pasó?", con botón de dictado (simulado: animación de grabación seguida de texto) y opción de adjuntar archivos. Al enviar, el contenido va a la bandeja y se abre directamente la revisión.
- Cuatro tarjetas resumen:
  - plata disponible del grupo hoy;
  - resultado del mes;
  - pendientes por revisar;
  - alertas.
- Lista de alertas, cada una con la opción "Posponer" (1 día, 3 días o 1 semana).
- Vencimientos de los próximos 30 días.

**Bandeja**

- Lista de los elementos recibidos, con su canal (icono), estado y número de propuestas.
- **Vista de revisión** con dos columnas:
  - **Izquierda:** el original intacto (imagen, texto o reproductor de audio), con los fragmentos de evidencia **resaltados**.
  - **Derecha:** las propuestas como tarjetas editables, cada una con:
    - tipo, monto, fecha, entidad, cuenta, proyecto, categoría y tercero;
    - la confianza, con color: verde ≥85, ámbar 60–84, rojo <60;
    - al pasar el cursor por un campo, se resalta su evidencia en el original.
- Los selects solo ofrecen valores de la configuración.
- **Acciones:** aprobar, corregir y aprobar, descartar, rechazar, marcar como duplicado, volver a leer, y agregar un registro o una tarea a mano.
- Las propuestas intercompañía o repartidas muestran la **vista previa del efecto** antes de aprobar.
- Una pestaña "Historial" con quién hizo qué y cuándo.

**Movimientos**

- Tabla con filtros por entidad, proyecto, cuenta, tipo, rango de fechas y "Sin soporte".
- Las filas sin soporte llevan un icono de alerta.
- Al hacer clic en una fila se abre un panel lateral con el detalle, sus líneas contables derivadas (vista "¿cómo afecta?") y el soporte original.

**Entre empresas**

- Matriz de "quién le debe a quién" entre las entidades.
- Al hacer clic en una celda se ve el detalle de los hechos que la forman.
- Botón "Registrar devolución" que crea un `pago_intercompania`.

**Tableros**

- Selector de vista: grupo, empresa o proyecto, con rango de fechas.
- Indicadores del punto 7.2. **Cada cifra es clicable** y lleva al detalle de los movimientos que la forman.
- Gráfica de ingresos frente a egresos de los últimos 6 meses.
- En la vista de grupo:
  - tabla con la suma por empresa;
  - interruptor "Incluir asuntos personales".
- Panel de **calidad del dato**:
  - pendientes;
  - movimientos sin soporte;
  - cuentas sin conciliar;
  - posibles duplicados.

**Créditos**

- Lista de créditos con su saldo real, la próxima cuota y una etiqueta si hay cuotas vencidas.
- **Detalle de cada crédito:**
  - condiciones;
  - tabla de amortización, con el estado de cada cuota: pagada, vencida o futura;
  - gráfica del saldo real frente al saldo según la tabla;
  - intereses y cargos pagados.
- **Acciones:**
  - registrar un pago, con el desglose en capital, interés y cargos ya prellenado desde la tabla;
  - registrar un desembolso;
  - cambiar condiciones (tasa o abono extra, con recálculo);
  - anotar el saldo que reporta el banco, para comparar.

### Alcance simple (basta con que se vean creíbles y naveguen)

- **Cierres:**
  - por mes y por cuenta, el saldo del sistema frente al saldo del extracto (este se ingresa a mano), con la diferencia y su explicación;
  - botón "Publicar cierre", que bloquea el mes con un candado y desactiva la edición de los hechos de ese mes;
  - "Reabrir", que pide un motivo y queda en el historial.
- **Agenda:**
  - obligaciones recurrentes, como arriendos, IVA, nómina y servicios;
  - vista de calendario mensual y vista de lista;
  - al registrar el pago, la obligación queda cumplida;
  - etiqueta "Sincronizado con Google Calendar" (simulada).
- **Chat:**
  - preguntas en español, con 5 a 8 preguntas predefinidas como "chips", por ejemplo:
    - "¿Cuánto le debe la Empresa A a la Empresa B?"
    - "¿Cuánto se gastó en nómina en octubre?"
    - "¿Cuál es el saldo del crédito constructor?"
  - las respuestas se calculan con las **mismas funciones de `domain/`** e incluyen enlaces a los movimientos;
  - si la pregunta no se reconoce o no hay datos, responde "No tengo datos para responder eso". Nunca inventa;
  - el chat solo consulta.
- **Informes:**
  - informe por proyecto, por empresa y del grupo, en vista imprimible;
  - botón "Paquete para el contador" (por empresa y periodo) que descarga un .zip simulado, o un CSV real con los movimientos y la lista de soportes.
- **Configuración:**
  - CRUD básico de entidades, cuentas, proyectos, categorías, terceros (con alias) y responsables;
  - pestaña "Registro de cambios", de solo lectura;
  - sección "Google Drive" con la estructura de carpetas propuesta y un botón "Carga inicial" que simula el proceso con barra de progreso y un resumen: encontrados, cargados, omitidos (duplicados) y fallidos.

---

## 11. Datos semilla (`src/data/seed.ts`)

Los datos deben ser coherentes y verse reales. Cubren de mayo a octubre de 2026, para que la gráfica de 6 meses tenga datos.

- **Entidades:**
  - Empresa A (taller y bodega);
  - Empresa B (comercial);
  - Empresa C (construcción, con el crédito constructor);
  - Empresa D (servicios);
  - Empresa E (inmobiliaria);
  - Asuntos personales.
- **Cuentas (4 bancarias):**
  - Bancolombia (Empresa B), alias "Bancolombia";
  - Banco B (Empresa A), alias "Banco B";
  - Davivienda (Empresa C);
  - Banco de Bogotá (Empresa D);
  - opcional: una caja menor por empresa.
- **Proyectos:** Taller (A), Bodega (A), Obra Laureles (C), Remodelación local (E).
- **Movimientos:** unos 60 por mes, con ingresos, costos, gastos de nómina y arriendo, servicios, IVA, traslados, 2 o 3 pagos intercompañía, 1 gasto repartido, inversiones en proyecto y pagos de créditos. Entre 10 y 15 % de ellos sin soporte.
- **Créditos:** 4 a 6 en la vista, aunque el cliente tiene 20 en la realidad. Uno de ellos es **exactamente** el del Ejemplo 3, llamado "Crédito constructor", de la Empresa C, con la cuota 1 pagada y la cuota 2 vencida.
- **Obligaciones:** arriendos, IVA bimestral, nómina quincenal y servicios públicos, con responsables con nombres ficticios.
- **Bandeja:** de 3 a 5 elementos pendientes al iniciar la demo, para que se vea trabajo por hacer.
- **Saldos iniciales y un cierre de septiembre ya publicado.**

---

## 12. Diseño

- Estética sobria y confiable, de herramienta financiera: fondo claro, un color de acento y mucho espacio en blanco. Que parezca software comercial, no una plantilla.
- **Colores con significado:**
  - verde para ingresos y lo aprobado;
  - rojo para lo vencido y los egresos;
  - ámbar para lo pendiente y lo que no tiene soporte.
- Cifras alineadas a la derecha, con fuente tabular (`font-variant-numeric: tabular-nums`).
- Estados vacíos, skeletons de carga y toasts de confirmación ("Movimiento aprobado").
- Modo oscuro opcional, no prioritario.

---

## 13. Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores, y `npm run build` y `npm run test` pasan.
- [ ] Las pruebas de Vitest de los Ejemplos 2 y 3 (puntos 7.3 y 7.4) y del gasto repartido pasan.
- [ ] El Ejemplo 1, pegado en la pantalla de inicio, genera exactamente las dos propuestas indicadas.
- [ ] Ninguna propuesta pendiente cambia saldos ni indicadores, solo el aviso "X por aprobar".
- [ ] Toda cifra de los tableros es clicable, lleva al detalle de movimientos y de ahí al soporte original.
- [ ] La vista de grupo no cuenta dos veces los gastos intercompañía ni muestra la deuda interna.
- [ ] Un mes con cierre publicado no permite editar sus movimientos. Reabrirlo pide un motivo.
- [ ] Todos los montos están en formato `$ 1.234.567` y todas las fechas en `dd/mm/aaaa`.
- [ ] Inicio y bandeja se usan bien en un ancho de 375 px.
- [ ] El botón "Reiniciar demo" restaura los datos semilla.

---

## 14. Fuera de alcance del prototipo

- Backend, base de datos real, login, 2FA, roles y permisos.
- IA real, OCR y transcripción.
- Integraciones reales con Google Drive, Gmail, Calendar o WhatsApp Business API (todo se simula).
- Conciliación bancaria automática, integración contable y facturación electrónica.

---

## 15. Forma de trabajo

Se rige por `AGENTS.md` (raíz y `frontend/`). Resumen de lo que cambia frente a la versión anterior de este documento:

- **Git:** el repo es `frontend/`. Ramas fijas `main` y `staging`; cada cambio en su rama `feat/...`, `fix/...`, `chore/...` o `docs/...` desde `staging`. La rama `prototipo` ya no se usa.
- Antes de cada commit se muestra el mensaje y el resumen de archivos para aprobación. **Nunca** se agrega a Claude como coautor.
- El avance se registra en `PROGRESS.md` (raíz) después de cada paso verificable.
- Orden de construcción:
  1. Scaffold, formatos y layout.
  2. `domain/` con sus pruebas.
  3. Datos semilla y servicios mock.
  4. Bandeja con la IA simulada.
  5. Inicio.
  6. Movimientos y Entre empresas.
  7. Tableros.
  8. Créditos.
  9. Pantallas simples.
  10. Pulido de la demo.
- Si algo es ambiguo (qué campos lleva un formulario o qué datos mostrar), **preguntar antes de construir**.

---

## 16. Glosario (español → código en inglés)

Decisión del 06/11/2026: los identificadores del código van en **inglés** (AGENTS.md §9). Los nombres de este documento son los términos de negocio; en el código se usan así:

| Negocio (este documento) | Código |
|---|---|
| Entidad / empresa | `Entity` (`entityId`) |
| Asuntos personales | `Entity` con `isPersonal: true` |
| Cuenta | `Account` |
| Proyecto | `Project` |
| Categoría (clase) | `Category` (`kind`) |
| Tercero | `Counterparty` |
| Responsable | `Assignee` |
| Hecho (lo que se aprueba) | `Transaction` |
| Tipo de hecho | `TransactionType`: `income`, `cost`, `expense`, `interest`, `project_investment`, `transfer`, `intercompany_payment`, `loan_disbursement`, `loan_payment` |
| Asignación (reparto) | `Allocation` |
| Entidad pagadora | `payerEntityId` |
| Línea de libro | `LedgerLine`; conceptos `cash`, `result`, `ic_receivable`, `ic_payable`, `loan`, `investment` |
| Soporte | `Attachment` |
| Bandeja / elemento de bandeja | `Inbox` / `InboxItem` |
| Propuesta | `Proposal` (`confidence`, `evidence`) |
| Crédito / cuota | `Loan` / `Installment` |
| Obligación / tarea | `Obligation` / `Task` |
| Cierre | `MonthClose` |
| Evento del historial | `AuditEvent` |
| Alcance (grupo, empresa, proyecto) | `Scope` |
| Indicador | `Kpi` |
| Intercompañía | `intercompany` (abreviado `ic`) |
| formatCOP, formatFecha, formatPct | `formatCOP`, `formatDate`, `formatPct` |

Las rutas de la interfaz (`/bandeja`, `/entre-empresas`…) y todos los textos visibles siguen en español.
