// Tipado fuerte de las rutas del Stack. Los tabs (Menú / Lista pariciones /
// Métricas / etc) NO son rutas del stack — viven dentro de MainTabs.
//
// Si agregás una pantalla que se abre por _encima_ de los tabs (push), va acá.

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  // Pariciones tiene Detail (read-only) entre la lista y el Form, porque la
  // info de causa/observaciones no se ve completa en la card y abrir el Form
  // implica entrar en modo edición innecesariamente. Los otros 3 módulos
  // siguen yendo directo al Form en edit mode — su info entra en la card.
  ParicionDetail: { paricionId: string };
  ParicionForm: { paricionId?: string } | undefined;
  LluviaForm: { lluviaId?: string } | undefined;
  MortandadForm: { mortandadId?: string } | undefined;
  PastoreoForm: { pastoreoId?: string } | undefined;
};
