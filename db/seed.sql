insert into users (acc, pwd_hash, role, name)
values
  ('admin', '$2b$10$0my2q9NkMv/2Rt4AEBzoTefEkG6B0iUm4XtCmpFkxLlutjSwyHPyK', 'admin', '管理員'),
  ('factory1', '$2b$10$0my2q9NkMv/2Rt4AEBzoTefEkG6B0iUm4XtCmpFkxLlutjSwyHPyK', 'factory', '測試工廠')
on conflict (acc) do nothing;

