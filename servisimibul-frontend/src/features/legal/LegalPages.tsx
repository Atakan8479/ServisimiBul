import { Link } from 'react-router-dom'
import { StatePanel } from '../../components/design-system'
import { noticeAvailable, APPROVED_NOTICE } from './legal-notices'
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

export function PublicRequestEntryPage() {
  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <h1>Kişisel veri başvuru yolu</h1>
        <p>
          Başvuru kanalı hukuki onay tamamlanana kadar burada yayınlanmaz.
          Hesabınız varsa oturum açarak devam edebilirsiniz.
        </p>
      </header>
      <StatePanel
        title="Başvuru kanalı henüz onaylanmadı"
        detail="Bu sayfa bir e-posta veya KEP adresi içermez; kanal kararı tamamlandığında burada yayınlanacaktır."
        tone="neutral"
      />
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
