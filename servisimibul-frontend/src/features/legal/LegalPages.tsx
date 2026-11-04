import { Link } from 'react-router-dom'
import {
  Button,
  FormField,
  StatePanel,
  SurfaceCard,
} from '../../components/design-system'
import {
  noticeAvailable,
  termsAvailable,
  APPROVED_NOTICE,
  APPROVED_TERMS,
} from './legal-notices'
import './legal.css'

export function PrivacyNoticePage() {
  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <h1>Gizlilik ve kişisel veriler</h1>
        <p>
          Bu sayfa, hukuki onayı tamamlanan aydınlatma metninin yayınlanacağı
          herkese açık yerdir.
        </p>
      </header>
      {noticeAvailable() ? (
        <p>{APPROVED_NOTICE?.body}</p>
      ) : (
        <StatePanel
          title="Aydınlatma metni henüz yayında değil"
          detail="Veri sorumlusu, işleme amaçları ve iletişim bilgileri hukuki inceleme tamamlanmadan burada yayınlanmaz."
          tone="neutral"
        />
      )}
      <p className="legal-page-note">
        Kişisel veri başvurusu yapmak isterseniz{' '}
        <Link to="/privacy/requests" viewTransition>
          başvuru yolunu görüntüleyin
        </Link>
        .
      </p>
    </div>
  )
}

export function TermsPage() {
  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <h1>Kullanım koşulları</h1>
        <p>
          Bu sayfa, hukuki onayı tamamlanan kullanım koşullarının yayınlanacağı
          herkese açık yerdir.
        </p>
      </header>
      {termsAvailable() ? (
        <p>{APPROVED_TERMS?.body}</p>
      ) : (
        <StatePanel
          title="Kullanım koşulları henüz yayında değil"
          detail="Platform sorumlulukları ve kullanıcı içeriklerine ilişkin koşullar hukuki inceleme tamamlanmadan burada yayınlanmaz."
          tone="neutral"
        />
      )}
    </div>
  )
}

export function PublicRequestEntryPage() {
  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <h1>Kişisel veri başvuru yolu</h1>
        <p>
          Başvuru kanalı hukuki onay tamamlanana kadar burada yayınlanmaz.
          Mevcut giriş sayfalarına aşağıdan ulaşabilirsiniz; oturum açmak
          kişisel veri başvurusu başlatmaz.
        </p>
      </header>
      <StatePanel
        title="Başvuru kanalı henüz onaylanmadı"
        detail="Bu sayfa bir e-posta veya KEP adresi içermez. Aşağıdaki form veri toplamaz; kanal ve kimlik doğrulama kararları tamamlanmadan kullanıma açılamaz."
        tone="neutral"
      />
      <RequestFormScaffold />
      <div className="legal-page-actions">
        <Link
          className="ui-button ui-button-secondary"
          to="/parent/login"
          viewTransition
        >
          Veli girişi
        </Link>
        <Link
          className="ui-button ui-button-secondary"
          to="/operator/login"
          viewTransition
        >
          İşletmeci girişi
        </Link>
      </div>
    </div>
  )
}

export function ParentRequestFormPage() {
  return <AuthenticatedRequestFormPage accountPath="/parent/account" />
}

export function OperatorRequestFormPage() {
  return <AuthenticatedRequestFormPage accountPath="/operator/account" />
}

function AuthenticatedRequestFormPage({
  accountPath,
}: {
  accountPath: string
}) {
  return (
    <section className="legal-page legal-request-authenticated-page">
      <header className="legal-page-header">
        <h1>Kişisel veri başvurusu</h1>
        <p>
          Oturumunuz hesap erişimini doğrular; kişisel veri başvurusu
          gönderildiği veya alındığı anlamına gelmez.
        </p>
      </header>
      <StatePanel
        title="Başvuru gönderimi henüz kullanılamıyor"
        detail="Başvuru kanalı, kapsamı ve kimlik doğrulama kuralları hukuki onay tamamlanmadan etkinleştirilemez."
        tone="neutral"
      />
      <RequestFormScaffold />
      <Link className="legal-page-back-link" to={accountPath} viewTransition>
        Hesap ve gizlilik sayfasına dön
      </Link>
    </section>
  )
}

function RequestFormScaffold() {
  return (
    <SurfaceCard className="legal-request-form-card">
      <div className="legal-request-form-heading">
        <h2>Kişisel veri başvuru formu</h2>
        <p>
          Bu taslak yalnızca başvuru konusu ve açıklama alanlarını gösterir;
          gereksiz kimlik veya hassas veri istemez.
        </p>
      </div>
      <form
        aria-describedby="request-form-unavailable"
        className="legal-request-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField
          hint="Başvuru türleri hukuki onaydan sonra burada listelenecek."
          htmlFor="request-category"
          label="Başvuru konusu"
        >
          <select disabled name="category">
            <option>Hukuki onay bekleniyor</option>
          </select>
        </FormField>
        <FormField
          hint="T.C. kimlik numarası, sağlık bilgisi veya öğrenci bilgisi yazmayın."
          htmlFor="request-description"
          label="Başvurunuzu açıklayın"
        >
          <textarea disabled maxLength={2000} name="description" rows={6} />
        </FormField>
        <p className="legal-request-form-guard" id="request-form-unavailable">
          Form şu anda bilgi göndermez veya kaydetmez.
        </p>
        <Button disabled type="submit">
          Başvuruyu gönder
        </Button>
      </form>
    </SurfaceCard>
  )
}
