-- Patch 11:病假(MC)附件上传
-- 可以重复执行,不会删除任何资料。

-- 1. leave_applications 新增一个栏位,存放附件在 Storage 里的路径
alter table leave_applications
  add column if not exists mc_attachment_path text;

-- 2. 建立私有的 Storage bucket(不是公开的,不能靠网址直接看,一定要签名连结)
insert into storage.buckets (id, name, public)
values ('mc-attachments', 'mc-attachments', false)
on conflict (id) do nothing;

-- 3. Storage 权限
--    文件路径规则是 `${employee_id}/文件名`,所以用路径的第一段(foldername)
--    比对是不是自己的 employee id,来判断谁能看、谁能传。
--    经理(is_manager())不受这个限制,任何员工的 MC 都能看、也能代传。

drop policy if exists "mc attachments: owner or manager can view" on storage.objects;
create policy "mc attachments: owner or manager can view" on storage.objects
  for select using (
    bucket_id = 'mc-attachments'
    and (
      is_manager()
      or (storage.foldername(name))[1] in (
        select id::text from employees where auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "mc attachments: owner or manager can upload" on storage.objects;
create policy "mc attachments: owner or manager can upload" on storage.objects
  for insert with check (
    bucket_id = 'mc-attachments'
    and (
      is_manager()
      or (storage.foldername(name))[1] in (
        select id::text from employees where auth_user_id = auth.uid()
      )
    )
  );

-- 只有经理能删除(例如传错文件的时候),员工自己不能删,避免拿掉已经交出去的 MC 证据。
drop policy if exists "mc attachments: manager can delete" on storage.objects;
create policy "mc attachments: manager can delete" on storage.objects
  for delete using (
    bucket_id = 'mc-attachments' and is_manager()
  );
