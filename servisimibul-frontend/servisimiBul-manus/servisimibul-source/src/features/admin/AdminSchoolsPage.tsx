import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Edit3, Plus } from 'lucide-react';
import { WorkspaceShell } from '../../components/Shells';
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Modal, PageHeader, SearchInput, SelectField } from '../../components/ui';
import { schools, type School } from '../../data/mockData';

type AdminSchool = School & { active: boolean };

const initialSchools: AdminSchool[] = schools.slice(0, 7).map((school, index) => ({
  ...school,
  active: index !== 3,
}));

const defaultDistricts = ['Kadıköy', 'Üsküdar', 'Ataşehir', 'Maltepe', 'Ümraniye', 'Beşiktaş', 'Bakırköy', 'Kartal'];
const defaultTypes = ['Anaokulu', 'İlkokul', 'Ortaokul', 'Lise', 'Kampüs', 'Özel okul'];

export function AdminSchoolsPage() {
  const [items, setItems] = useState<AdminSchool[]>(initialSchools);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const editingSchool = items.find((school) => school.id === editingId) ?? null;
  const filtered = useMemo(
    () => items.filter((school) => `${school.name} ${school.district} ${school.neighborhood}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))),
    [items, query],
  );
  const districtOptions = useMemo(
    () => Array.from(new Set([...defaultDistricts, ...items.map((school) => school.district)])),
    [items],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set([...defaultTypes, ...items.map((school) => school.type)])),
    [items],
  );

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const saveSchool = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get('name')).trim(),
      type: String(data.get('type')),
      district: String(data.get('district')),
      neighborhood: String(data.get('neighborhood')).trim(),
    };
    if (editingSchool) {
      setItems((list) => list.map((school) => school.id === editingSchool.id ? { ...school, ...values } : school));
      setNotice(`${values.name} okul kaydı prototipte güncellendi.`);
    } else {
      setItems((list) => [{ id: `new-${Date.now()}`, ...values, active: true }, ...list]);
      setNotice(`${values.name} okul kaydı prototip kataloğuna eklendi.`);
    }
    closeModal();
  };

  const toggle = (id: string) => {
    setItems((list) => list.map((school) => school.id === id ? { ...school, active: !school.active } : school));
  };

  return (
    <WorkspaceShell role="admin">
      <PageHeader
        eyebrow="YÖNETİM PANELİ"
        title="Okul kataloğu"
        description="Örnek okul kayıtlarını ve dizin durumlarını yönet."
        actions={<Button onClick={() => { setEditingId(null); setModalOpen(true); }}><Plus size={15}/>Okul ekle</Button>}
      />
      <DemoNotice>Okul kayıtları kurgusaldır; ekleme ve düzenleme yalnızca prototip state’ini değiştirir.</DemoNotice>
      {notice && <div className="form-success"><CheckCircle2 size={15}/>{notice}</div>}
      <div className="table-toolbar">
        <SearchInput placeholder="Okul, ilçe veya mahalle ara" value={query} onChange={(event) => setQuery(event.target.value)}/>
        <div className="table-toolbar-right">
          <Badge tone="green" dot>{items.filter((school) => school.active).length} aktif</Badge>
          <Badge tone="neutral">{items.length} toplam</Badge>
        </div>
      </div>
      <Card className="data-table-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>OKUL</th><th>TÜR</th><th>İLÇE / MAHALLE</th><th>DURUM</th><th>İŞLEM</th></tr></thead>
            <tbody>
              {filtered.map((school) => (
                <tr key={school.id}>
                  <td><div className="table-school"><span className="table-school-icon"><span>{school.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span></span><div><strong>{school.name}</strong><small>Örnek kayıt</small></div></div></td>
                  <td>{school.type}</td>
                  <td>{school.district}<small className="cell-subtext">{school.neighborhood}</small></td>
                  <td><Badge tone={school.active ? 'green' : 'neutral'} dot>{school.active ? 'Aktif' : 'Devre dışı'}</Badge></td>
                  <td><div className="table-actions"><Button variant="quiet" size="sm" onClick={() => { setEditingId(school.id); setModalOpen(true); }}><Edit3 size={14}/>Düzenle</Button><Button variant="quiet" size="sm" onClick={() => toggle(school.id)}>{school.active ? 'Devre dışı bırak' : 'Etkinleştir'}</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState title="Okul bulunamadı" description="Arama terimini değiştir ya da yeni okul ekle."/>}
      </Card>
      <Modal
        open={modalOpen}
        title={editingSchool ? 'Okul kaydını düzenle' : 'Okul ekle'}
        description="Kurgusal okul kataloğu kaydı. Değişiklikler yalnızca prototipte tutulur."
        onClose={closeModal}
      >
        <form className="form-grid" onSubmit={saveSchool}>
          <Field className="field-full" label="Okul adı" name="name" defaultValue={editingSchool?.name ?? ''} placeholder="Örn. Ufuk Çocuk Akademisi" required/>
          <SelectField label="Okul türü" name="type" defaultValue={editingSchool?.type ?? defaultTypes[0]}>
            {typeOptions.map((type) => <option key={type}>{type}</option>)}
          </SelectField>
          <SelectField label="İlçe" name="district" defaultValue={editingSchool?.district ?? defaultDistricts[0]}>
            {districtOptions.map((district) => <option key={district}>{district}</option>)}
          </SelectField>
          <Field label="Mahalle" name="neighborhood" defaultValue={editingSchool?.neighborhood ?? ''} placeholder="Örn. Koşuyolu" required/>
          <div className="modal-actions field-full">
            <Button variant="outline" type="button" onClick={closeModal}>Vazgeç</Button>
            <Button type="submit"><CheckCircle2 size={15}/>{editingSchool ? 'Değişiklikleri kaydet' : 'Okulu ekle'}</Button>
          </div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}
