#!/usr/bin/env python3
"""
bootstrap_auth_users.py — Crea los 16 usuarios de Ganaderas en Supabase Auth.

Las tablas `usuarios` (custom) y `auth.users` (de Supabase Auth) son distintas.
El seed SQL llena `usuarios` (perfil + cliente_id), pero falta crear los
auth.users con email + password para que el signInWithPassword funcione.

Este script usa la Admin API de Supabase (requiere service_role key) para
crear los users en bulk, con email_confirm=true (no requieren verificación
por email).

Uso:
    1. Crear `.env` en esta carpeta con:
       SUPABASE_URL=https://xxx.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=eyJ...
       INITIAL_PASSWORD=ganaderas2024
    2. pip install supabase python-dotenv
    3. python bootstrap_auth_users.py
    4. Los 16 usuarios pueden loguearse con su email + INITIAL_PASSWORD.
    5. Cada uno cambia su password después con el self-service de la app.

IMPORTANTE: el SUPABASE_SERVICE_ROLE_KEY bypassea RLS y permite crear/borrar
cualquier cosa. NO lo commitees, NO lo embebés en la app mobile.
"""

import os
import sys
import json
from pathlib import Path

# Lista de usuarios reales de Ganaderas (extraída del Excel + nuestro seed)
USUARIOS = [
    'agusufi20@gmail.com',
    'nelsonisidrolopez2025@gmail.com',
    'alejandromiguel9087@gmail.com',
    'emilianogabrielzerpa5@gmail.com',
    'ruedaroberto431@gmail.com',
    'luisfernandocarranza155@gmail.com',
    'armandocollante15@gmail.com',
    'montenegrocarlosariel32@gmail.com',
    'robustianoasaravia@gmail.com',
    'victorjaviersaravia2@gmail.com',
    'panchofreytes@gmail.com',
    'carranzamiguel584@gmail.com',
    'matiasortiz.gva@gmail.com',
    'hugogustavogonzalez459@gmail.com',
    'exico.cuellar25@gmail.com',
    'rosariodidziulis8@gmail.com',
]


def main():
    try:
        from supabase import create_client
        from dotenv import load_dotenv
    except ImportError:
        print("ERROR: faltan dependencies. Ejecutá: pip install supabase python-dotenv")
        sys.exit(1)

    load_dotenv(Path(__file__).parent / '.env')
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    initial_password = os.getenv('INITIAL_PASSWORD', 'ganaderas2024')

    if not url or not key:
        print("ERROR: definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env")
        sys.exit(1)

    supabase = create_client(url, key)

    created = 0
    skipped = 0
    errors = []
    for email in USUARIOS:
        try:
            # admin.create_user es Supabase Admin API, requiere service_role key.
            res = supabase.auth.admin.create_user({
                'email': email,
                'password': initial_password,
                'email_confirm': True,  # skip email verification flow
            })
            if res.user:
                print(f"  ✓ Creado: {email}")
                created += 1
            else:
                errors.append((email, 'sin user en respuesta'))
        except Exception as e:
            msg = str(e)
            if 'already' in msg.lower() or 'duplicate' in msg.lower():
                print(f"  - Ya existe: {email}")
                skipped += 1
            else:
                print(f"  ✗ Error con {email}: {msg}")
                errors.append((email, msg))

    print(f"\nResumen: {created} creados, {skipped} ya existían, {len(errors)} errores")
    print(f"\nTodos los usuarios pueden loguearse ahora con su email + '{initial_password}'.")
    print("Recomendá que cada uno cambie su password en el primer login.")

    if errors:
        print("\nErrores:")
        for email, msg in errors:
            print(f"  {email}: {msg}")
        sys.exit(1)


if __name__ == '__main__':
    main()
