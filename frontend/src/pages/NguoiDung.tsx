import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Loi, TaiDang, TieuDe } from "../components/ui";

interface U { email: string; ten: string | null; vai_tro: string; trang_thai: string; created_at: string }

export default function NguoiDung({ toi }: { toi: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => api<{ rows: U[] }>("/users") });
  const sua = useMutation({ mutationFn: ({ email, ...b }: { email: string; vai_tro?: string; trang_thai?: string }) => api(`/users/${encodeURIComponent(email)}`, { method: "PATCH", json: b }), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
  if (q.isLoading) return <TaiDang />;
  if (q.error) return <Loi loi={q.error} />;
  return (
    <div>
      <TieuDe ten="Người dùng" moTa="Tài khoản mới đăng nhập bằng Google sẽ ở trạng thái Chờ duyệt. Khoá = đăng xuất mọi thiết bị." />
      {sua.error && <Loi loi={sua.error} />}
      <table className="tbl">
        <thead>
          <tr>
            <th>Email</th>
            <th>Tên</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Tạo lúc</th>
          </tr>
        </thead>
        <tbody>
          {q.data!.rows.map((u) => (
            <tr key={u.email}>
              <td>{u.email}</td>
              <td>{u.ten}</td>
              <td>
                <select className="input" disabled={u.email === toi} value={u.vai_tro} onChange={(e) => sua.mutate({ email: u.email, vai_tro: e.target.value })}>
                  <option value="xem">Chỉ xem</option>
                  <option value="nhap_lieu">Nhập liệu</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>
                <select className="input" disabled={u.email === toi} value={u.trang_thai} onChange={(e) => sua.mutate({ email: u.email, trang_thai: e.target.value })}>
                  <option value="cho_duyet">Chờ duyệt</option>
                  <option value="da_duyet">Đã duyệt</option>
                  <option value="khoa">Khoá</option>
                </select>
              </td>
              <td>{u.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
