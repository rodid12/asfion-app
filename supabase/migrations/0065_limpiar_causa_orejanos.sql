-- Orejano no admite causa de muerte. Limpia cargas históricas inválidas y
-- blinda también escrituras de versiones antiguas de la app.

BEGIN;

UPDATE public.pariciones
SET causa_tipo = NULL
WHERE cliente_id = 'ganaderas'
  AND upper(btrim(coalesce(sexo, ''))) = 'OREJANO'
  AND upper(btrim(coalesce(causa_tipo, ''))) = 'NACIDO MUERTO';

CREATE OR REPLACE FUNCTION public.limpiar_causa_orejano()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF upper(btrim(coalesce(NEW.sexo, ''))) = 'OREJANO' THEN
    NEW.causa_tipo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pariciones_limpiar_causa_orejano ON public.pariciones;
CREATE TRIGGER pariciones_limpiar_causa_orejano
BEFORE INSERT OR UPDATE OF sexo, causa_tipo ON public.pariciones
FOR EACH ROW
EXECUTE FUNCTION public.limpiar_causa_orejano();

COMMIT;

