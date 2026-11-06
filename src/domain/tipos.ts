// Tipos de dominio. Montos en pesos enteros (COP), fechas ISO yyyy-mm-dd.

export type Entidad = { id: string; nombre: string; alias: string[]; esPersonal: boolean; descripcion?: string }
export type Cuenta = {
  id: string; entidadId: string; banco: string; nombre: string; alias: string[]
  saldoInicial: number; fechaSaldoInicial: string
}
export type Proyecto = { id: string; entidadId: string; nombre: string; alias: string[] }
export type ClaseCategoria = 'ingreso' | 'costo_venta' | 'gasto_operativo' | 'financiero' | 'inversion'
export type Categoria = { id: string; nombre: string; clase: ClaseCategoria; alias: string[] }
export type Tercero = { id: string; nombre: string; alias: string[] }
export type Responsable = { id: string; nombre: string; cargo: string }

export type TipoHecho =
  | 'ingreso' | 'costo' | 'gasto' | 'interes' | 'inversion_proyecto'
  | 'traslado' | 'pago_intercompania' | 'desembolso_credito' | 'pago_credito'

export type Asignacion = { entidadId: string; proyectoId?: string; monto: number }
export type DesglosePago = { capital: number; interes: number; cargos: number }

export type Hecho = {
  id: string; tipo: TipoHecho; fecha: string; monto: number; descripcion: string
  cuentaOrigenId?: string; cuentaDestinoId?: string
  entidadPagadoraId: string
  asignaciones: Asignacion[]
  categoriaId?: string; terceroId?: string; creditoId?: string
  numeroCuota?: number
  desglosePagoCredito?: DesglosePago
  soporteIds: string[]; origenBandejaId?: string
  aprobadoPor: string; aprobadoEn: string
}

export type ConceptoLinea = 'caja' | 'resultado' | 'por_cobrar_ic' | 'por_pagar_ic' | 'credito' | 'inversion'
export type ClaseResultado = 'ingreso' | 'costo_venta' | 'gasto_operativo' | 'financiero'

export type LineaLibro = {
  hechoId: string; fecha: string; entidadId: string; concepto: ConceptoLinea; monto: number
  cuentaId?: string; proyectoId?: string; claseResultado?: ClaseResultado
  contraparteId?: string // en líneas intercompañía: la otra entidad
}

export type Canal = 'manual' | 'whatsapp' | 'whatsapp_export' | 'correo' | 'drive'
export type Soporte = {
  id: string; nombre: string; tipoMime: string; tamano: number; contenidoTexto?: string
  urlMock: string; recibidoEn: string; canal: Canal; hash: string
}

export type Evidencia = { campo: string; textoFuente: string; inicio: number; fin: number }
export type EstadoPropuesta = 'pendiente' | 'aprobada' | 'corregida' | 'descartada' | 'rechazada' | 'duplicado'
export type CamposPropuesta = Partial<Omit<Hecho, 'id' | 'aprobadoPor' | 'aprobadoEn'>> & {
  tituloTarea?: string; vence?: string
}
export type Propuesta = {
  id: string; tipo: TipoHecho | 'tarea'; campos: CamposPropuesta
  confianza: number; evidencia: Evidencia[]; estado: EstadoPropuesta
  posibleDuplicadoDe?: string; hechoId?: string; nota?: string
}
export type ItemBandeja = {
  id: string; soporteId: string; estado: 'pendiente' | 'procesando' | 'revisado'
  propuestas: Propuesta[]; recibidoEn: string; canal: Canal
  textoExtraido?: string; transcripcion?: boolean; archivoDuplicadoDe?: string; entrante?: boolean
}

export type TipoTasa = 'EA' | 'MV'
export type PagoCredito = { hechoId: string; numeroCuota: number; capital: number; interes: number; cargos: number; fecha: string }
export type CambioCredito = { fecha: string; tipo: 'tasa' | 'abono_extra'; valor: number; nota: string }
export type Credito = {
  id: string; nombre: string; banco: string; entidadId: string; cuentaId?: string; monto: number
  tasa: { valor: number; tipo: TipoTasa } // valor como fracción: 0,145 = 14,5 %
  numCuotas: number; primeraFecha: string; cargosPorCuota: number
  pagos: PagoCredito[]; saldosBanco: { fecha: string; saldo: number }[]; cambios: CambioCredito[]
}

export type Recurrencia = 'mensual' | 'quincenal' | 'bimestral' | 'anual' | 'unica'
export type Obligacion = {
  id: string; nombre: string; entidadId: string; valor: number
  diaVencimiento?: number; fecha?: string; recurrencia: Recurrencia; responsableId: string
  categoriaId?: string
  cumplidas: { periodo: string; hechoId?: string; fecha: string }[] // periodo = fecha de vencimiento cumplida
}
export type Tarea = { id: string; titulo: string; vence: string; entidadId?: string; creditoId?: string; origenPropuestaId?: string; hecha: boolean }
export type Cierre = {
  id: string; entidadId: string; cuentaId: string; mes: string
  saldoSistema: number; saldoExtracto: number | null
  diferencias: { monto: number; explicacion: string }[]
  estado: 'abierto' | 'publicado'; reaperturas: { fecha: string; motivo: string; usuario: string }[]
  publicadoEn?: string
}
export type EventoHistorial = { fecha: string; usuario: string; accion: string; objeto: string; detalle: string; ref?: string }

export type Rol = 'administrador' | 'asistente' | 'contador'
