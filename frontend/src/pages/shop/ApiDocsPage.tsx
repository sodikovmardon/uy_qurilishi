import { Code2, KeyRound, ShieldCheck } from 'lucide-react';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/products/',
    desc: 'Barcha mahsulotlar ro\'yxati',
    params: [
      { name: 'category', desc: "Kategoriya bo'yicha filtr, masalan `category=G'isht`" },
      { name: 'search', desc: 'Nom yoki tavsif bo\'yicha qidiruv, masalan `search=silikat`' },
      { name: 'in_stock', desc: 'Faqat omborda borlar uchun `in_stock=true`' },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/products/{id}/',
    desc: 'Bitta mahsulot to\'liq ma\'lumotlari',
    params: [],
  },
  {
    method: 'GET',
    path: '/api/v1/categories/',
    desc: 'Mavjud kategoriyalar va har biridagi mahsulot soni',
    params: [],
  },
];

const EXAMPLE = `{
  "id": 1,
  "name": "Silikat g'isht",
  "category": "G'isht",
  "unit": "dona",
  "price": 1850,
  "stock_quantity": 12500,
  "stock_status": "Mavjud",
  "image_url": "https://.../media/store/products/1.jpg",
  "description": "Oddiy silikat g'isht...",
  "sku": "BRI-SIL-250",
  "last_updated": "2026-08-07T22:39:37+05:00"
}`;

export function ApiDocsPage() {
  return (
    <div className="api-docs">
      <header className="api-docs-hero">
        <h1 className="store-title">Do'kon API hujjatlari</h1>
        <p className="store-subtitle">
          Tashqi hamkor ilovalar (qurilish kalkulyatori) uchun ochiq, o'qish-uchun-mo'ljallangan API.
        </p>
      </header>

      <section className="api-card">
        <div className="api-card-head">
          <Code2 className="w-4 h-4" />
          <h2>Asosiy ma'lumot</h2>
        </div>
        <ul className="api-list">
          <li>Barcha javoblar <b>JSON</b>, maydonlar <b>snake_case</b>.</li>
          <li>Status kodlari: <code>200</code> (ok), <code>404</code> (topilmadi), <code>401</code> (kalit xato), <code>429</code> (limit oshdi).</li>
          <li>Rate-limit: <code>120 so'rov/daqiqa</code> har bir IP uchun.</li>
          <li>CORS yoqilgan — brauzerdan ham chaqirish mumkin.</li>
          <li>Server-to-server ulanish tavsiya etiladi (API kaliti header orqali).</li>
        </ul>
      </section>

      <section className="api-card">
        <div className="api-card-head">
          <KeyRound className="w-4 h-4" />
          <h2>API kaliti</h2>
        </div>
        <p className="api-text">
          Kalit <code>X-API-Key</code> header orqali uzatiladi. Kalit chiqarilmasa API ochiq bo'ladi;
          birinchi kalit chiqarilgach, barcha so'rovlarda kalit majburiy bo'ladi.
        </p>
        <pre className="api-code">curl -H "X-API-Key: sizning_kalitingiz" \
  https://sayt/api/v1/products/?category=G'isht</pre>
      </section>

      <section className="api-card">
        <div className="api-card-head">
          <ShieldCheck className="w-4 h-4" />
          <h2>Endpointlar</h2>
        </div>
        <div className="api-endpoints">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="api-endpoint">
              <div className="api-endpoint-head">
                <span className={`api-method api-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                <code className="api-path">{ep.path}</code>
              </div>
              <p className="api-endpoint-desc">{ep.desc}</p>
              {ep.params.length > 0 && (
                <table className="api-params">
                  <thead>
                    <tr>
                      <th>Parametr</th>
                      <th>Tavsif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.params.map((p) => (
                      <tr key={p.name}>
                        <td><code>{p.name}</code></td>
                        <td>{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="api-card">
        <div className="api-card-head">
          <Code2 className="w-4 h-4" />
          <h2>Misol javob</h2>
        </div>
        <pre className="api-code">{EXAMPLE}</pre>
      </section>
    </div>
  );
}
