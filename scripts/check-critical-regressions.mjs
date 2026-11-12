import { readFile } from 'node:fs/promises';

const files = {
  compra: new URL('../src/screens/compras/CompraDetailScreen.tsx', import.meta.url),
  pdf: new URL('../src/lib/pdfExport.ts', import.meta.url),
  paricion: new URL('../src/screens/pariciones/ParicionFormScreen.tsx', import.meta.url),
  mortandad: new URL('../src/screens/mortandad/MortandadFormScreen.tsx', import.meta.url),
  ganaderas: new URL('../src/config/clients/ganaderas.ts', import.meta.url),
  clientConfig: new URL('../src/config/ClientConfigContext.tsx', import.meta.url),
  paricionList: new URL('../src/screens/pariciones/ParicionListScreen.tsx', import.meta.url),
  paricionDetail: new URL('../src/screens/pariciones/ParicionDetailScreen.tsx', import.meta.url),
  mapa: new URL('../src/components/MapPickerModal.tsx', import.meta.url),
  compraForm: new URL('../src/screens/compras/CompraFormScreen.tsx', import.meta.url),
  metricas: new URL('../src/screens/metricas/MetricasScreen.tsx', import.meta.url),
  pastoreoForm: new URL('../src/screens/pastoreo/PastoreoFormScreen.tsx', import.meta.url),
  lluviaForm: new URL('../src/screens/lluvias/LluviaFormScreen.tsx', import.meta.url),
  causaMortandad: new URL('../src/lib/mortandadCause.ts', import.meta.url),
  migracionDelete: new URL('../supabase/migrations/0059_bloquear_borrado_total_pariciones.sql', import.meta.url),
  migracion: new URL('../supabase/migrations/0061_hotfix_caravana_unica_por_campania.sql', import.meta.url),
  migracionRecepcion: new URL('../supabase/migrations/0062_urgencias_recepcion_ganaderas.sql', import.meta.url),
  migracionMetricas311: new URL('../supabase/migrations/0063_metricas_311_ganaderas.sql', import.meta.url),
  migracionEmailsCarahuasi: new URL('../supabase/migrations/0064_actualizar_emails_administradores_carahuasi.sql', import.meta.url),
  migracionOrejano: new URL('../supabase/migrations/0065_limpiar_causa_orejanos.sql', import.meta.url),
  fotos: new URL('../src/components/PhotoStrip.tsx', import.meta.url),
  migracionEscrituraCarahuasi: new URL('../supabase/migrations/0066_hotfix_escritura_carahuasi.sql', import.meta.url),
  migracionEscrituraGoogle: new URL('../supabase/migrations/0067_escritura_google_y_tenant_superadmin.sql', import.meta.url),
  migracionFotosUpsert: new URL('../supabase/migrations/0068_fotos_storage_upsert.sql', import.meta.url),
  repository: new URL('../src/data/repository.ts', import.meta.url),
  supabaseBackend: new URL('../src/data/backends/supabase.ts', import.meta.url),
  tareaList: new URL('../src/screens/tareas/TareaListScreen.tsx', import.meta.url),
  tareaForm: new URL('../src/screens/tareas/TareaFormScreen.tsx', import.meta.url),
  migracionTareas: new URL('../supabase/migrations/0069_tareas_carahuasi.sql', import.meta.url),
  rootNavigator: new URL('../src/navigation/RootNavigator.tsx', import.meta.url),
  tareaSafeScreens: new URL('../src/screens/tareas/TareaSafeScreens.tsx', import.meta.url),
  appBoundary: new URL('../src/components/AppErrorBoundary.tsx', import.meta.url),
  appRoot: new URL('../App.tsx', import.meta.url),
  easConfig: new URL('../eas.json', import.meta.url),
  packageJson: new URL('../package.json', import.meta.url),
};

const [compra, pdf, paricion, mortandad, ganaderas, clientConfig, paricionList, paricionDetail, mapa, compraForm, metricas, pastoreoForm, lluviaForm, causaMortandad, migracionDelete, migracion, migracionRecepcion, migracionMetricas311, migracionEmailsCarahuasi, migracionOrejano, fotos, migracionEscrituraCarahuasi, migracionEscrituraGoogle, migracionFotosUpsert, repository, supabaseBackend, tareaList, tareaForm, migracionTareas, rootNavigator, tareaSafeScreens, appBoundary, appRoot, easConfig, packageJson] = await Promise.all(
  Object.values(files).map(file => readFile(file, 'utf8')),
);

const checks = [
  {
    ok: !/Total estimado|precio\s*\*\s*compra\.kgNetosDestino/i.test(compra),
    message: 'Compras volvió a mostrar o calcular el total estimado.',
  },
  {
    ok: /Print\.printToFileAsync\(\{ html, base64: false \}\)/.test(pdf) &&
      /await compartirPDF\(Sharing, uri,/.test(pdf) &&
      !/Print\.printAsync\(\{ uri \}\)/.test(pdf),
    message: 'El PDF volvió a enviarse al diálogo de impresión vacío en vez de abrir el selector para compartir.',
  },
  {
    ok: /repo\.buscarCaravana\([\s\S]*caravanaColor,[\s\S]*numero,[\s\S]*evento,[\s\S]*fecha,[\s\S]*paricionId/.test(paricion),
    message: 'El formulario dejó de validar caravanas repetidas.',
  },
  {
    ok: /CREATE TRIGGER pariciones_caravana_unica_trigger/.test(migracion) &&
      /evento_normalizado/.test(migracion) &&
      /campania_scope/.test(migracion) &&
      /p\.campania_id/.test(migracion),
    message: 'Falta la protección correctamente acotada de caravanas repetidas en la base de datos.',
  },
  {
    ok: /evento === ['"]Muerte['"] && sexo !== ['"]Orejano['"]/.test(paricion) &&
      /if \(!causaVisible\)/.test(paricion),
    message: 'Orejano volvió a mostrar o conservar una causa de muerte oculta.',
  },
  {
    ok: /Recepción:\s*\[['"]Novillito['"],\s*['"]Vaq 1['"],\s*['"]TernH['"],\s*['"]TernM['"]\]/.test(ganaderas) &&
      /!esRecepcion/.test(mortandad) &&
      /Color de caravana/.test(mortandad) &&
      /N° de caravana/.test(mortandad),
    message: 'Se perdió el flujo específico de Recepción en Corrales.',
  },
  {
    ok: /row\.id === ACTIVE_CONFIG\.id[\s\S]*EMPTY_CATALOGOS/.test(clientConfig),
    message: 'Un tenant desconocido puede volver a heredar catálogos de Ganaderas.',
  },
  {
    ok: /!isSuperAdmin && clienteId !== ACTIVE_CONFIG\.id[\s\S]*catalogos:\s*\{\}/.test(clientConfig) &&
      /mergeStringArrayRecords\([\s\S]*fallback\.categoriasPorActividad/.test(clientConfig),
    message: 'El arranque o un cache antiguo puede volver a filtrar catálogos entre clientes.',
  },
  {
    ok: /categoriasPorActividad,Recepción/.test(migracionRecepcion) &&
      /Novillito/.test(migracionRecepcion) && /Vaq 1/.test(migracionRecepcion),
    message: 'Falta la migración de categorías de Recepción en Supabase.',
  },
  {
    ok: /b\.fecha\.localeCompare\(a\.fecha\)/.test(paricionList) &&
      /b\.createdAt[\s\S]*localeCompare\(a\.createdAt/.test(paricionList) &&
      /colorFiltro[\s\S]*caravanaColor/.test(paricionList) &&
      /sexoFiltro[\s\S]*p\.sexo/.test(paricionList),
    message: 'El listado de pariciones perdió el orden por carga o sus filtros de sexo/color.',
  },
  {
    ok: /NO regeneran el WebView/.test(mapa) &&
      /setBaseLayer\(['"]satellite['"]\)/.test(mapa) &&
      /marker\.setLatLng/.test(mapa),
    message: 'El mapa puede volver a cambiar de capa al mover el pin.',
  },
  {
    ok: /maxCorrelativoDelAño/.test(compraForm) && /generarNumeroOperacion\(fecha, max\)/.test(compraForm),
    message: 'Compras perdió la numeración correlativa automática.',
  },
  {
    ok: /pariciones_delete/.test(migracionDelete) &&
      /FOR DELETE TO authenticated[\s\S]*USING \(false\)/.test(migracionDelete),
    message: 'Pariciones dejó de bloquear el borrado de registros.',
  },
  {
    ok: /const campoIdsVisibles = useMemo/.test(metricas) &&
      /data\.filter\(p => campoIdsVisibles\.has\(p\.campoId\)\)/.test(metricas) &&
      !/data\.filter\(p => p\.usuarioEmail === user\.email\)/.test(metricas),
    message: 'Las métricas del operario volvieron a mostrar solo sus cargas en vez del campo asignado.',
  },
  {
    ok: /title=["']Mermas["']/.test(metricas) &&
      /Retacto/.test(metricas) && /Nacido muerto/.test(metricas) &&
      /Muerte señalado/.test(metricas) && /Math\.floor\(orejanos\.size \/ 2\)/.test(metricas) &&
      /Cantidades absolutas/.test(metricas) &&
      !/stockBaseMermas/.test(metricas) &&
      /p\.sexo !== ['"]Orejano['"] && causa === ['"]NACIDO MUERTO['"]/.test(metricas),
    message: 'Se perdió el desglose de mermas o el criterio Orejanos ÷ 2.',
  },
  {
    ok: /UPDATE public\.pariciones/.test(migracionOrejano) &&
      /causa_tipo = NULL/.test(migracionOrejano) &&
      /pariciones_limpiar_causa_orejano/.test(migracionOrejano) &&
      /BEFORE INSERT OR UPDATE OF sexo, causa_tipo/.test(migracionOrejano),
    message: 'Falta limpiar o impedir la causa Nacido Muerto en Orejanos.',
  },
  {
    ok: /launchCameraAsync/.test(fotos) &&
      /requestMediaLibraryPermissionsAsync/.test(fotos) &&
      /launchImageLibraryAsync/.test(fotos) &&
      /allowsMultipleSelection:\s*disponibles > 1/.test(fotos) &&
      /text:\s*['"]Galería['"]/.test(fotos),
    message: 'El selector de fotos perdió la opción de cámara o galería.',
  },
  {
    ok: /paricion\.fotos && paricion\.fotos\.length > 0/.test(paricionDetail) &&
      /setFotoAmpliada\(uri\)/.test(paricionDetail) &&
      /source=\{\{ uri: fotoAmpliada \}\}/.test(paricionDetail),
    message: 'El detalle de pariciones dejó de mostrar o ampliar las fotos cargadas.',
  },
  {
    ok: /lower\(btrim\(u\.email\)\) = lower\(btrim\(auth\.jwt\(\) ->> 'email'\)\)/.test(migracionEscrituraCarahuasi) &&
      /CREATE POLICY pariciones_write/.test(migracionEscrituraCarahuasi) &&
      /CREATE POLICY fotos_eventos_insert_policy/.test(migracionEscrituraCarahuasi) &&
      /CREATE POLICY fotos_eventos_update_policy/.test(migracionEscrituraCarahuasi),
    message: 'Falta el hotfix de escritura para clientes activos y fotos.',
  },
  {
    ok: /public\.current_user_email\(\)/.test(migracionEscrituraGoogle) &&
      /public\.requested_admin_cliente_id\(\)/.test(migracionEscrituraGoogle) &&
      /CREATE POLICY pariciones_write/.test(migracionEscrituraGoogle),
    message: 'La escritura dejó de preservar el acceso con Google o el tenant del superadministrador.',
  },
  {
    ok: /CREATE POLICY fotos_eventos_select_policy/.test(migracionFotosUpsert) &&
      /FOR SELECT TO authenticated/.test(migracionFotosUpsert) &&
      /CREATE POLICY fotos_eventos_update_policy/.test(migracionFotosUpsert),
    message: 'Storage dejó de permitir el upsert seguro de fotos por cliente.',
  },
  {
    ok: /subscription\.status === ['"]active['"]/.test(repository) &&
      /La cuenta está habilitada, pero esta sesión no tiene permisos/.test(repository) &&
      /msg\.toLowerCase\(\)\.includes\(['"]jwt['"]\)[\s\S]*msg\.toLowerCase\(\)\.includes\(['"]expired['"]\)/.test(supabaseBackend),
    message: 'La app puede volver a confundir cualquier rechazo RLS con una mora.',
  },
  {
    ok: /mortandadCampo/.test(metricas) && /camposDisponiblesMortandad/.test(metricas) &&
      /canonicalizarCausaMortandad/.test(metricas) &&
      /origen: ['"]Pariciones['"]/.test(metricas) &&
      /\.filter\(p => p\.evento === ['"]Muerte['"]\)/.test(metricas) &&
      /claveAnimalMortandad/.test(metricas) &&
      /Desconocida/.test(causaMortandad) && /Infección/.test(causaMortandad),
    message: 'Mortandad perdió el filtro por campo, la vista consolidada o la estandarización de causas.',
  },
  {
    ok: /p\.evento === ['"]Nacimiento['"] && p\.sexo !== ['"]Orejano['"]/.test(metricas),
    message: 'El KPI Nacimientos volvió a incluir Orejanos y dejó de coincidir con el dashboard web.',
  },
  {
    ok: /disabled=\{!loteId\}/.test(paricion) &&
      /disabled=\{!loteId \|\| !vacasGrupo\}/.test(paricion) &&
      /disabled=\{!campoId\}/.test(mortandad) && /disabled=\{!actividad\}/.test(mortandad) &&
      /disabled=\{!parcelaId\}/.test(pastoreoForm) && /editable=\{!!pluviometroId\}/.test(lluviaForm),
    message: 'Los formularios dejaron de respetar la jerarquía de carga.',
  },
  {
    ok: /p\.campaniaId === campaniaReproductivaSeleccionada\.id/.test(metricas) &&
      /d0a6ea85/.test(migracionMetricas311) &&
      /evento = 'Retacto'/.test(migracionMetricas311) &&
      /campania-ganaderas-2026-2027/.test(migracionMetricas311),
    message: 'Retacto o la corrección del Orejano inválido dejaron de vincularse a la campaña actual.',
  },
  {
    ok: /hugosaravia\.carahuasi@gmail\.com/.test(migracionEmailsCarahuasi) &&
      /hugosaraviafigueroa@gmail\.com/.test(migracionEmailsCarahuasi) &&
      /torreshuidobrozoe@gmail\.com/.test(migracionEmailsCarahuasi),
    message: 'La migración dejó de conservar los emails corregidos de los administradores de Carahuasi.',
  },
  {
    ok: /current_user_is_task_admin/.test(migracionTareas) &&
      /lower\(btrim\(asignado_email\)\) = public\.current_user_email\(\)/.test(migracionTareas) &&
      /observación es obligatoria/.test(migracionTareas) &&
      /tareas_historial/.test(migracionTareas) &&
      /deleted_at/.test(migracionTareas) &&
      /WHERE id = 'estancia-carahuasi'/.test(migracionTareas),
    message: 'Tareas perdió el aislamiento de Carahuasi, la auditoría o los permisos por rol.',
  },
  {
    ok: /label="TOTAL"/.test(tareaList) &&
      /metricas\.completadas/.test(tareaList) &&
      /metricas\.noCompletadas/.test(tareaList) &&
      /metricas\.pendientes/.test(tareaList) &&
      /Math\.round\(completadas \/ total \* 100\)/.test(tareaList) &&
      /repo\.subscribeTareas/.test(tareaList),
    message: 'El seguimiento de tareas perdió métricas, filtros o actualización automática.',
  },
  {
    ok: /estado !== ['"]no_completada['"] \|\| observacionesOperario\.trim\(\)/.test(tareaForm) &&
      /repo\.listTareaHistorial/.test(tareaForm) &&
      /repo\.eliminarTarea/.test(tareaForm),
    message: 'El formulario de tareas perdió la observación obligatoria, historial o baja auditada.',
  },
  {
    ok: /hasModulo\(['"]tareas['"]\)/.test(rootNavigator) &&
      /component=\{SafeTareaListScreen\}/.test(rootNavigator) &&
      /component=\{SafeTareaFormScreen\}/.test(rootNavigator) &&
      !/import \{ TareaListScreen \}/.test(rootNavigator) &&
      !/import \{ TareaFormScreen \}/.test(rootNavigator) &&
      /require\(['"]\.\/TareaListScreen['"]\)/.test(tareaSafeScreens) &&
      /require\(['"]\.\/TareaFormScreen['"]\)/.test(tareaSafeScreens) &&
      /class TareaErrorBoundary/.test(tareaSafeScreens) &&
      /El resto de ASFION sigue funcionando normalmente/.test(tareaSafeScreens),
    message: 'Tareas volvió a cargarse durante el arranque y puede impedir que toda la app abra.',
  },
  {
    ok: /class AppErrorBoundary/.test(appBoundary) &&
      /getDerivedStateFromError/.test(appBoundary) &&
      /<AppErrorBoundary>/.test(appRoot) &&
      /<RootNavigator \/>/.test(appRoot),
    message: 'La aplicación perdió la pantalla de recuperación ante errores JavaScript de arranque.',
  },
  {
    ok: /"qa"[\s\S]*"channel": "qa"/.test(easConfig) &&
      /"field-production"[\s\S]*"channel": "production"/.test(easConfig) &&
      /"verify:ota"/.test(packageJson) &&
      /"ota:qa"/.test(packageJson) &&
      /"ota:production"/.test(packageJson),
    message: 'Las publicaciones de prueba y de campo volvieron a compartir canal o perdieron el preflight obligatorio.',
  },
];

const failed = checks.filter(check => !check.ok);
if (failed.length > 0) {
  failed.forEach(check => console.error(`✗ ${check.message}`));
  process.exit(1);
}

console.log('✓ Regresiones críticas verificadas: compras, PDF, caravanas, Orejano, Recepción, aislamiento, orden/filtros, mapa, permisos, mermas y tareas.');
