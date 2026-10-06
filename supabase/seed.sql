-- Seed accounts only. No contributions, ledger rows, QR codes, or redemptions.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@example.com',
    extensions.crypt('KokuaAdmin123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Kōkua Admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'student@hawaii.edu',
    extensions.crypt('KokuaStudent123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Kai"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'eatery@example.com',
    extensions.crypt('KokuaEatery123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Plate Lunch Co"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'sub', '00000000-0000-0000-0000-000000000001',
      'email', 'admin@example.com',
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    jsonb_build_object(
      'sub', '00000000-0000-0000-0000-000000000002',
      'email', 'student@hawaii.edu',
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'sub', '00000000-0000-0000-0000-000000000003',
      'email', 'eatery@example.com',
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

INSERT INTO public.users (
  id,
  role,
  display_name,
  public_alias,
  verified_school_domain,
  is_active
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'Kōkua Admin',
    NULL,
    NULL,
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'student',
    'Kai',
    'Kai',
    'hawaii.edu',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'eatery',
    'Plate Lunch Co',
    NULL,
    NULL,
    TRUE
  );

INSERT INTO public.eateries (
  id,
  owner_user_id,
  name,
  slug,
  address,
  island,
  contact_email,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000003',
  'Plate Lunch Co',
  'plate-lunch-co',
  '1234 King Street, Honolulu, HI 96813',
  'Oʻahu',
  'eatery@example.com',
  TRUE
);
