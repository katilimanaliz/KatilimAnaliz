import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const fmtN = (n, d = 2) => isNaN(n)||n===null ? "—" : new Intl.NumberFormat("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fmtTL = (n) => isNaN(n)||n===null ? "—" : new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",minimumFractionDigits:2}).format(n);

const DEFAULT_SETTINGS = {
  stopajTL_0_180:17.5, stopajTL_181_365:15, stopajTL_365plus:10, stopajYP_tum:25,
  bireyselKKDF:15, bireyselBSMV:15, ticariKKDF:0, ticariBSMV:5,
  zkTL_vadesiz:17, zkTL_6ay:10, zkYP_vadesiz:30, zkYP_diger:26,
  fonlamaMaliyeti:24.0,
  referansOran:3.11,
  bkmTakas:3.36,
  cariKarPayiOran:35.0,
  katilimKarPayiOran:2.0,
};

const C = {
  bg:"#F5F6F8", card:"#FFFFFF",
  blue:"#2C5F8A", blueLight:"#EBF3FB",        // Soft koyu mavi - kurumsal
  green:"#3A7D5C", greenLight:"#EBF5F0",      // Soft yeşil
  orange:"#B07D2E", orangeLight:"#FBF5E8",    // Altın/soft sarı
  purple:"#5B4A8A", purpleLight:"#F0EDF8",
  red:"#B83232", pink:"#9C3060", pinkLight:"#F9ECF2",
  teal:"#2A7A72", tealLight:"#E8F5F4",
  label:"#1C2B3A", sub:"#6B7B8D", border:"#DDE3EA", sep:"#B8C4CE",
};

function Card({children,style}){return <div style={{background:C.card,borderRadius:16,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",...style}}>{children}</div>;}
function SecTitle({children}){return <p style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10,marginTop:2}}>{children}</p>;}

function formatWithDots(val){
  // val is a string possibly with dots already
  const clean = val.replace(/\./g,'').replace(/[^0-9,]/g,'');
  const parts = clean.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return parts.join(',');
}

function parseVal(val){
  // remove dots (thousands sep), keep comma as decimal
  if(!val) return '';
  return val.replace(/\./g,'').replace(',','.');
}

function TutarField({label,value,onChange,suffix,hint}){
  const [display,setDisplay] = useState(value?formatWithDots(String(value)):'');
  const handleChange = (e)=>{
    const raw = e.target.value;
    // Allow only digits, dots (sep), comma (decimal)
    const cleaned = raw.replace(/[^0-9,]/g,'');
    const formatted = formatWithDots(cleaned);
    setDisplay(formatted);
    // send raw numeric string to parent
    onChange(parseVal(formatted));
  };
  // sync if value cleared externally
  useEffect(()=>{ if(!value) setDisplay(''); },[value]);
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>{label}</label>
      <div style={{position:"relative"}}>
        <input inputMode="decimal" value={display} onChange={handleChange}
          style={{width:"100%",boxSizing:"border-box",padding:suffix?"11px 40px 11px 13px":"11px 13px",
            fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",
            border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
        {suffix&&<span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{suffix}</span>}
      </div>
      {hint&&<p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>{hint}</p>}
    </div>
  );
}

function Field({label,value,onChange,suffix,hint,type="number",prefix}){
  // For ₺ fields use TutarField
  if(suffix==="₺" || suffix==="$" || suffix==="€"){
    return <TutarField label={label} value={value} onChange={onChange} suffix={suffix} hint={hint}/>;
  }
  const padLeft = prefix ? "11px 40px 11px 32px" : suffix ? "11px 40px 11px 13px" : "11px 13px";
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>{label}</label>
      <div style={{position:"relative"}}>
        {prefix&&<span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14,zIndex:1}}>{prefix}</span>}
        <input type={type} inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",padding:padLeft,
            fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",
            border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
        {suffix&&<span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{suffix}</span>}
      </div>
      {hint&&<p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>{hint}</p>}
    </div>
  );
}

function Seg({options,value,onChange}){
  return(
    <div style={{display:"flex",background:"#E5E5EA",borderRadius:9,padding:2,marginBottom:14}}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)} style={{
          flex:1,padding:"7px 2px",borderRadius:7,border:"none",cursor:"pointer",
          background:value===o.v?C.card:"transparent",
          color:value===o.v?"#1C1C1E":C.sub,
          fontWeight:value===o.v?700:500,fontSize:12,
          boxShadow:value===o.v?"0 1px 3px rgba(0,0,0,0.12)":"none",transition:"all 0.15s",
        }}>{o.l}</button>
      ))}
    </div>
  );
}

function RRow({label,value,accent,sub,big}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:sub?"7px 0":"10px 0",borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:sub?12:14,color:sub?C.sub:C.label}}>{label}</span>
      <span style={{fontSize:big?19:sub?13:15,fontWeight:big?800:700,fontFamily:"monospace",color:accent||"#1C1C1E"}}>{value}</span>
    </div>
  );
}

// ─── FON GETİRİ İZLEME VE HESAPLAMA ────────────────────────────────────────────


// ─── Tema: Uygulamayla aynı açık ton ─────────────────────────────────────────
const FC = {
  bg:      "#F5F6F8",
  card:    "#FFFFFF",
  cardAlt: "#F9F9FB",
  blue:    "#2C5F8A",
  green:   "#3A7D5C",
  greenL:  "#EBF5F0",
  red:     "#B83232",
  redL:    "#FEF2F2",
  orange:  "#B07D2E",
  orangeL: "#FBF5E8",
  border:  "#E5E9F0",
  text:    "#1C1C1E",
  sub:     "#6B7280",
  sub2:    "#9CA3AF",
};

// ─── Canlı veri ─────────────────────────────────────────────────────────────────
// Vakıf Katılım öncelikli sıralama için oncelik değeri API'den sonra atanır
const VAKIF_KODLARI = ["VLT","VHS","VKK","VKV","VPA"];

const PERIODS = [
  { key:"gunluk",   label:"Günlük"   },
  { key:"haftalik", label:"Haftalık" },
  { key:"aylik",    label:"Aylık"    },
  { key:"uc_aylik", label:"3 Aylık"  },
  { key:"ytd",      label:"YTD"      },
  { key:"yillik",   label:"1 Yıllık" },
];

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function tutarFormat(v) {
  const raw = v.replace(/[^0-9,]/g,"");
  const [int,...rest] = raw.split(",");
  const fmtInt = int.replace(/\B(?=(\d{3})+(?!\d))/g,".");
  return rest.length ? fmtInt+","+rest.join("") : fmtInt;
}
function tutarParse(s) { return parseFloat(s.replace(/\./g,"").replace(",","."))||0; }
function fmt(n,d=2) { return n.toLocaleString("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtPct(v) { if(v==null)return"—"; return(v>=0?"+":"")+v.toFixed(2)+"%"; }
function yillikBasit(gunlukPct) { if(!gunlukPct||gunlukPct===0)return null; return gunlukPct*365; }
function pctCol(v) { if(!v&&v!==0)return FC.sub2; return v>0?FC.green:v<0?FC.red:FC.sub2; }
function fmtPF(v) {
  if(!v)return"—";
  if(v>=1e9)return(v/1e9).toFixed(2)+" Mr ₺";
  if(v>=1e6)return(v/1e6).toFixed(0)+" Mn ₺";
  return"—";
}
function kisaYon(y) { return y.replace(" Katılım Portföy","").replace(" Portföy",""); }

// Ayarlardan stopaj oku — prop yoksa localStorage fallback
function stopajOranSec(vade, settings) {
  const s0 = settings?.stopajTL_0_180  ?? 17.5;
  const s1 = settings?.stopajTL_181_365 ?? 15;
  const s2 = settings?.stopajTL_365plus ?? 10;
  if (vade <= 180) return s0;
  if (vade <= 365) return s1;
  return s2;
}

// ─── Getiri Hesaplayıcı ───────────────────────────────────────────────────────
function GetiriHesaplayici({ fon, settings, onKapat }) {
  const [tutarStr, setTutarStr] = useState("");
  const [vade,     setVade]     = useState("1");
  const [oran,     setOran]     = useState(String(Math.abs(fon.gunluk).toFixed(4)));
  const [tuzel,    setTuzel]    = useState(false);

  const sonuc = useMemo(() => {
    const T = tutarParse(tutarStr);
    const V = parseInt(vade)||0;
    const R = parseFloat(oran.replace(",","."))||0;
    if(T<=0||V<=0||R<=0) return null;
    const r = R/100;
    const brutGetiri = V===1 ? T*r : T*(Math.pow(1+r,V)-1);
    const sOran  = tuzel ? 0 : stopajOranSec(V, settings);
    const stopajTL   = brutGetiri*(sOran/100);
    const netGetiri  = brutGetiri-stopajTL;
    const netTutar   = T+netGetiri;
    const brutYillik = (Math.pow(1+r,365)-1)*100;
    const netYillik  = brutYillik*(1-sOran/100);
    return {T,V,R,brutGetiri,sOran,stopajTL,netGetiri,netTutar,brutYillik,netYillik};
  },[tutarStr,vade,oran,tuzel,settings]);

  const vadeBracket = sonuc
    ? (tuzel ? "Tüzel — Stopaj Yok"
      : `Bireysel — %${sonuc.sOran.toFixed(1)} Stopaj (${sonuc.V}g)`)
    : "";

  return (
    <div style={hs.wrap}>
      {/* Başlık */}
      <div style={hs.header}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={hs.fonBadge}>{fon.kod}</div>
          <span style={hs.title}>Getiri Hesaplayıcı</span>
        </div>
        <button onClick={onKapat} style={hs.kapat}>✕</button>
      </div>
      <div style={hs.fonAd}>{fon.ad}</div>

      {/* Bireysel / Tüzel */}
      <div style={hs.toggleRow}>
        <div style={hs.toggleGroup}>
          <button onClick={()=>setTuzel(false)}
            style={{...hs.tBtn,...(!tuzel?hs.tBtnAktif:{})}}>Bireysel</button>
          <button onClick={()=>setTuzel(true)}
            style={{...hs.tBtn,...(tuzel?hs.tBtnTuzel:{})}}>Tüzel</button>
        </div>
        {sonuc && <span style={hs.badge}>{vadeBracket}</span>}
      </div>

      {/* Giriş */}
      <div style={hs.grid3}>
        {[
          { lbl:"Fon Tutarı",     val:tutarStr, suf:"₺",    ph:"0",      set:v=>setTutarStr(tutarFormat(v)), mode:"decimal"  },
          { lbl:"Vade (Gün)",     val:vade,     suf:"gün",  ph:"30",     set:v=>setVade(v.replace(/\D/g,"")), mode:"numeric" },
          { lbl:"Günlük Oran",    val:oran,     suf:"%/gün",ph:"0.0000", set:setOran,                          mode:"decimal" },
        ].map(f=>(
          <div key={f.lbl} style={hs.grp}>
            <label style={hs.lbl}>{f.lbl}</label>
            <div style={hs.iWrap}>
              <input style={hs.inp} placeholder={f.ph} value={f.val}
                onChange={e=>f.set(e.target.value)} inputMode={f.mode}/>
              <span style={hs.suf}>{f.suf}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hesaplama notu */}
      <div style={hs.nota}>
        {sonuc&&sonuc.V>1 ? `Bileşik hesaplama · (1 + %${sonuc.R.toFixed(4)})^${sonuc.V}`
          : sonuc&&sonuc.V===1 ? "Basit hesaplama · 1 günlük getiri"
          : "Tutar, vade ve oran giriniz"}
      </div>

      {sonuc && (
        <>
          <div style={hs.divider}/>

          {/* Sonuç kartları */}
          <div style={hs.grid3}>
            <div style={hs.kart}>
              <div style={hs.kLbl}>Brüt Getiri</div>
              <div style={{...hs.kVal,color:FC.green}}>+{fmt(sonuc.brutGetiri)} ₺</div>
              <div style={hs.kAlt}>%{fmt(sonuc.brutYillik)} yıllık</div>
            </div>
            <div style={{...hs.kart,opacity:tuzel?0.45:1}}>
              <div style={hs.kLbl}>Stopaj Kesintisi</div>
              <div style={{...hs.kVal,color:FC.red}}>
                {tuzel?"—":`-${fmt(sonuc.stopajTL)} ₺`}
              </div>
              <div style={hs.kAlt}>
                {tuzel?"Tüzel müşteri":`%${sonuc.sOran.toFixed(1)} oran`}
              </div>
            </div>
            <div style={{...hs.kart,background:FC.greenL,border:`1.5px solid ${FC.green}22`}}>
              <div style={hs.kLbl}>Net Getiri</div>
              <div style={{...hs.kVal,color:FC.green,fontSize:17}}>+{fmt(sonuc.netGetiri)} ₺</div>
              <div style={hs.kAlt}>%{fmt(sonuc.netYillik)} yıllık</div>
            </div>
          </div>

          {/* Net tutar */}
          <div style={hs.netBox}>
            <span style={hs.netLbl}>Vade Sonu Net Tutar</span>
            <span style={hs.netVal}>{fmt(sonuc.netTutar)} ₺</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
// props: settings (uygulamanın global settings state'i — stopajTL_* alanları okunur)
function FonGetiriIzleme({ settings }) {
  // Eğer prop gelmezse localStorage'dan oku (standalone kullanım)
  const [localSettings, setLocalSettings] = useState(null);
  useEffect(()=>{
    if(!settings){
      try{
        const s=localStorage.getItem("vk_settings");
        if(s) setLocalSettings(JSON.parse(s));
      }catch{}
    }
  },[settings]);
  const effectiveSettings = settings ?? localSettings;

  const [aktifPeriod, setAktifPeriod] = useState("gunluk");
  const [arama,       setArama]       = useState("");
  const [filtreYon,   setFiltreYon]   = useState("Tümü");
  const [secilenFon,  setSecilenFon]  = useState(null);
  const [hesapFon,    setHesapFon]    = useState(null);
  const [fonlar,      setFonlar]      = useState([]);
  const [yukleniyor,  setYukleniyor]  = useState(true);
  const [hata,        setHata]        = useState(null);

  // ── Canlı veri çek ────────────────────────────────────────────────────────
  useEffect(()=>{
    const veriCek = async () => {
      setYukleniyor(true);
      setHata(null);
      try {
        const r = await fetch("/api/tefas-proxy");
        const json = await r.json();
        if(!json.success) throw new Error(json.error || "Veri alınamadı");
        // Vakıf Katılım fonlarına öncelik ver
        const veriyle = json.data.map(f => ({
          ...f,
          oncelik: VAKIF_KODLARI.includes(f.kod) ? 1 : 2,
        }));
        setFonlar(veriyle);
      } catch(e) {
        setHata(e.message);
      } finally {
        setYukleniyor(false);
      }
    };
    veriCek();
  },[]);

  const YONETICILER = useMemo(()=>[...new Set(fonlar.map(f=>f.yonetici))],[fonlar]);

  const maxVal = useMemo(()=>Math.max(...fonlar.map(f=>Math.abs(f[aktifPeriod]??0)),1),[fonlar,aktifPeriod]);

  const filtreli = useMemo(()=>{
    const q=arama.toUpperCase().trim();
    return fonlar
      .filter(f=>{
        const aOk=!q||f.ad.toUpperCase().includes(q)||f.kod.toUpperCase().includes(q)||f.yonetici.toUpperCase().includes(q);
        const yOk=filtreYon==="Tümü"||f.yonetici===filtreYon;
        return aOk&&yOk;
      })
      .sort((a,b)=>{
        if(a.oncelik!==b.oncelik) return a.oncelik-b.oncelik;
        return (b[aktifPeriod]??-Infinity)-(a[aktifPeriod]??-Infinity);
      });
  },[arama,aktifPeriod,filtreYon,fonlar]);

  const ort = useMemo(()=>{
    const v=filtreli.map(f=>f[aktifPeriod]).filter(x=>x!=null&&x!==0);
    return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  },[filtreli,aktifPeriod]);

  const enIyi = useMemo(()=>
    [...fonlar]
      .filter(f=>filtreYon==="Tümü"||f.yonetici===filtreYon)
      .sort((a,b)=>(b[aktifPeriod]??-Infinity)-(a[aktifPeriod]??-Infinity))[0]
  ,[fonlar,aktifPeriod,filtreYon]);

  const periodLabel=PERIODS.find(p=>p.key===aktifPeriod)?.label;

  const handleFonTikla=useCallback((fon)=>{
    if(secilenFon?.kod===fon.kod){setSecilenFon(null);setHesapFon(null);}
    else{setSecilenFon(fon);setHesapFon(null);}
  },[secilenFon]);

  return (
    <div style={s.wrap}>
      <style>{`@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Başlık */}
      <div style={s.header}>
        <div style={s.hL}>
          <div style={s.hIcon}>📈</div>
          <div>
            <div style={s.hTitle}>Fon Getiri İzleme ve Hesaplama</div>
            <div style={s.hSub}>TKBB onaylı · {fonlar.length} fon · TEFAS</div>
          </div>
        </div>
        <div style={s.hR}>
          <div style={s.sLbl}>{periodLabel} Ort.</div>
          <div style={{...s.sVal,color:pctCol(ort)}}>{fmtPct(ort)}</div>
        </div>
      </div>

      {/* Dönem sekmeler */}
      <div style={s.segWrap}>
        {PERIODS.map(p=>(
          <button key={p.key} onClick={()=>setAktifPeriod(p.key)}
            style={{...s.seg,...(aktifPeriod===p.key?s.segA:{})}}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Yönetici filtresi */}
      <div style={s.filterRow}>
        {["Tümü",...YONETICILER].map(y=>(
          <button key={y} onClick={()=>setFiltreYon(y)}
            style={{...s.fBtn,...(filtreYon===y?s.fBtnA:{})}}>
            {y==="Tümü"?"Tümü":kisaYon(y)}
          </button>
        ))}
      </div>

      {/* En iyi kart */}
      {enIyi&&(
        <div style={s.enIyiKart} onClick={()=>handleFonTikla(enIyi)}>
          <div style={{flex:1,minWidth:0}}>
            <div style={s.enIyiLbl}>🏆 {periodLabel} En İyi Getiri</div>
            <div style={s.enIyiKod}>{enIyi.kod}</div>
            <div style={s.enIyiAd}>{enIyi.ad.length>52?enIyi.ad.slice(0,52)+"…":enIyi.ad}</div>
          </div>
          <div style={{...s.enIyiPct,color:pctCol(enIyi[aktifPeriod])}}>{fmtPct(enIyi[aktifPeriod])}</div>
        </div>
      )}

      {/* Arama */}
      <div style={s.srch}>
        <span style={{color:FC.sub2,fontSize:15}}>🔍</span>
        <input style={s.srchIn} placeholder="Fon kodu veya adı ara…"
          value={arama} onChange={e=>setArama(e.target.value)}/>
        {arama&&<button style={s.clr} onClick={()=>setArama("")}>✕</button>}
      </div>

      {/* Tablo başlığı */}
      <div style={s.thRow}>
        <span style={{flex:1}}>Fon</span>
        <span style={{width:86,textAlign:"right"}}>{periodLabel}</span>
        <span style={{width:82,textAlign:"right"}}>Yıllık</span>
        <span style={{width:88,textAlign:"right"}}>Portföy</span>
      </div>

      {/* Liste */}
      <div>
        {yukleniyor ? (
          <div style={s.empty}>
            <div style={{fontSize:24,marginBottom:8}}>⟳</div>
            <div>TEFAS verileri yükleniyor…</div>
          </div>
        ) : hata ? (
          <div style={s.empty}>
            <div style={{fontSize:20,marginBottom:8,color:FC.red}}>⚠</div>
            <div style={{color:FC.red,marginBottom:8}}>{hata}</div>
            <button onClick={()=>window.location.reload()} style={{padding:"6px 16px",borderRadius:8,border:`1px solid ${FC.green}`,background:FC.greenL,color:FC.green,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Tekrar Dene</button>
          </div>
        ) : filtreli.length===0
          ? <div style={s.empty}>Sonuç bulunamadı.</div>
          : filtreli.map((fon,i)=>{
              const g  =fon[aktifPeriod];
              const barW=Math.round((Math.abs(g??0)/maxVal)*100);
              const sel=secilenFon?.kod===fon.kod;
              const vakif=fon.oncelik===1;
              return (
                <div key={fon.kod}>
                  {/* Fon satırı */}
                  <div onClick={()=>handleFonTikla(fon)} style={{
                    ...s.satir,
                    background:sel?FC.greenL:i%2===0?FC.card:FC.cardAlt,
                    borderLeft:sel?`3px solid ${FC.green}`:vakif?`3px solid ${FC.green}44`:"3px solid transparent",
                  }}>
                    <div style={s.fonL}>
                      <span style={s.idx}>{i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:1}}>
                          <span style={{...s.fKod,color:vakif?FC.green:FC.blue}}>{fon.kod}</span>
                          <span style={s.fYon}>{kisaYon(fon.yonetici)}</span>
                          {vakif&&<span style={{fontSize:9,color:FC.green,opacity:0.7}}>★</span>}
                        </div>
                        <span style={s.fAd}>{fon.ad.length>52?fon.ad.slice(0,52)+"…":fon.ad}</span>
                        {/* Günlük oran satırı — sadece günlük sekmede göster */}
                        {fon.gunluk!==0&&(
                          <div style={s.oranSatir}>
                            <span style={s.gunlukOran}>
                              günlük {fon.gunluk>=0?"+":""}{fon.gunluk.toFixed(4)}%
                            </span>
                          </div>
                        )}
                        <div style={s.barWrap}>
                          <div style={{...s.bar,width:`${barW}%`,background:pctCol(g)}}/>
                        </div>
                      </div>
                    </div>
                    <div style={{width:86,textAlign:"right"}}>
                      <span style={{...s.gtr,color:pctCol(g)}}>
                        {g==null?"—":(g>=0?"+":"")+g.toFixed(aktifPeriod==="gunluk"?4:2)+"%"}
                      </span>
                    </div>
                    <div style={{width:82,textAlign:"right"}}>
                      {fon.gunluk!==0
                        ? <span style={{...s.gtr,fontSize:12,color:pctCol(fon.gunluk)}}>
                            {fmtPct(yillikBasit(fon.gunluk))}
                          </span>
                        : <span style={{fontSize:11,color:FC.sub2}}>—</span>
                      }
                    </div>
                    <span style={s.pf}>{fmtPF(fon.portfoy)}</span>
                  </div>

                  {/* Detay paneli */}
                  {sel&&(
                    <div style={s.detayWrap}>
                      {/* Dönem grid */}
                      <div style={s.donemGrid}>
                        {PERIODS.map(p=>(
                          <div key={p.key} style={{...s.donemH,
                            background:p.key===aktifPeriod?FC.greenL:FC.cardAlt,
                            border:`1px solid ${p.key===aktifPeriod?FC.green+"44":FC.border}`}}>
                            <div style={s.donemL}>{p.label}</div>
                            <div style={{...s.donemV,color:pctCol(fon[p.key])}}>{fmtPct(fon[p.key])}</div>
                          </div>
                        ))}
                      </div>

                      <div style={s.detayAlt}>
                        <span style={{fontSize:11,color:FC.sub}}>
                          Portföy: <strong style={{color:FC.text}}>{fmtPF(fon.portfoy)}</strong>
                        </span>
                        <button
                          onClick={e=>{e.stopPropagation();setHesapFon(hesapFon?.kod===fon.kod?null:fon);}}
                          style={{...s.hesapBtn,...(hesapFon?.kod===fon.kod?s.hesapBtnA:{})}}>
                          {hesapFon?.kod===fon.kod?"✕ Kapat":"∑ Getiri Hesapla"}
                        </button>
                      </div>

                      {hesapFon?.kod===fon.kod&&(
                        <GetiriHesaplayici
                          fon={fon}
                          settings={effectiveSettings}
                          onKapat={()=>setHesapFon(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* Alt bilgi */}
      <div style={s.footer}>
        <span style={{color:FC.sub2}}>{filtreli.length} / {fonlar.length} fon</span>
        <span style={{color:FC.sub2,fontSize:10}}>🕗 Her gün 08:30'da güncellenir · Fonoloji · TEFAS</span>
      </div>
    </div>
  );
}

// ─── Ana bileşen stilleri ─────────────────────────────────────────────────────
const s = {
  wrap:{background:FC.bg,borderRadius:16,padding:"16px 14px 14px",maxWidth:760,margin:"0 auto",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif",color:FC.text},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  hL:{display:"flex",alignItems:"center",gap:10},
  hIcon:{width:36,height:36,borderRadius:10,background:"#EBF5F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20},
  hTitle:{fontSize:15,fontWeight:700,color:FC.text,letterSpacing:-0.2},
  hSub:{fontSize:11,color:FC.sub,marginTop:2},
  hR:{textAlign:"right"},
  sLbl:{fontSize:10,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5},
  sVal:{fontSize:20,fontWeight:700,fontVariantNumeric:"tabular-nums"},
  segWrap:{display:"flex",background:"#E5E5EA",borderRadius:9,padding:2,marginBottom:10,gap:0},
  seg:{flex:1,padding:"6px 0",border:"none",background:"none",color:FC.sub,fontSize:11,fontWeight:500,cursor:"pointer",borderRadius:7,transition:"all 0.15s",fontFamily:"inherit"},
  segA:{background:FC.card,color:FC.green,fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"},
  filterRow:{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"},
  fBtn:{padding:"4px 9px",borderRadius:6,border:`1px solid ${FC.border}`,background:FC.card,color:FC.sub,fontSize:10,cursor:"pointer",fontFamily:"inherit"},
  fBtnA:{background:FC.greenL,borderColor:FC.green+"55",color:FC.green,fontWeight:600},
  enIyiKart:{display:"flex",justifyContent:"space-between",alignItems:"center",background:FC.card,border:`1.5px solid ${FC.green}33`,borderLeft:`4px solid ${FC.green}`,borderRadius:12,padding:"11px 14px",marginBottom:10,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  enIyiLbl:{fontSize:10,color:FC.sub,marginBottom:3},
  enIyiKod:{fontSize:14,fontWeight:800,color:FC.green,letterSpacing:0.5},
  enIyiAd:{fontSize:10,color:FC.sub,marginTop:1},
  enIyiPct:{fontSize:22,fontWeight:800,fontVariantNumeric:"tabular-nums",flexShrink:0,marginLeft:12},
  srch:{display:"flex",alignItems:"center",background:FC.card,border:`1.5px solid ${FC.border}`,borderRadius:10,padding:"8px 11px",marginBottom:10,gap:8,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  srchIn:{flex:1,background:"none",border:"none",outline:"none",color:FC.text,fontSize:13,fontFamily:"inherit"},
  clr:{background:"none",border:"none",color:FC.sub,cursor:"pointer",fontSize:12,padding:0,fontFamily:"inherit"},
  thRow:{display:"flex",alignItems:"center",padding:"0 10px 6px",fontSize:10,fontWeight:700,color:FC.sub,textTransform:"uppercase",letterSpacing:0.6,borderBottom:`1.5px solid ${FC.border}`,marginBottom:0},
  empty:{textAlign:"center",padding:"40px 0",color:FC.sub,fontSize:13},
  satir:{display:"flex",alignItems:"center",padding:"9px 10px",cursor:"pointer",transition:"background 0.1s",borderLeft:"3px solid transparent"},
  fonL:{flex:1,display:"flex",alignItems:"flex-start",gap:8,minWidth:0},
  idx:{fontSize:10,color:FC.sub2,width:16,paddingTop:2,flexShrink:0,textAlign:"right"},
  fKod:{fontSize:12,fontWeight:700,letterSpacing:0.5},
  fYon:{fontSize:10,color:FC.sub2},
  fAd:{fontSize:11,color:FC.sub,display:"block",lineHeight:1.3,marginBottom:3},
  oranSatir:{display:"flex",alignItems:"center",gap:4,marginBottom:3,flexWrap:"wrap"},
  gunlukOran:{fontSize:10,color:FC.sub,fontVariantNumeric:"tabular-nums",fontFamily:"monospace"},
  oranAyrac:{fontSize:10,color:FC.sub2},
  yillikOran:{fontSize:10,fontWeight:600,fontVariantNumeric:"tabular-nums",fontFamily:"monospace"},
  barWrap:{height:2,background:FC.border,borderRadius:1,overflow:"hidden",maxWidth:180},
  bar:{height:"100%",borderRadius:1,opacity:0.45,transition:"width 0.35s ease"},
  gtr:{fontSize:14,fontWeight:700,fontVariantNumeric:"tabular-nums",display:"block"},
  pf:{width:88,textAlign:"right",fontSize:11,color:FC.sub},
  detayWrap:{background:"#F0F5F0",borderRadius:"0 0 10px 10px",padding:"10px 10px 12px",marginBottom:2,animation:"fi 0.2s ease",borderLeft:`3px solid ${FC.green}`,borderTop:`1px solid ${FC.green}22`},
  donemGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:8},
  donemH:{borderRadius:8,padding:"7px 9px",transition:"all 0.15s"},
  donemL:{fontSize:9,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2},
  donemV:{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums"},
  detayAlt:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  hesapBtn:{padding:"6px 12px",borderRadius:8,border:`1px solid ${FC.green}55`,background:FC.greenL,color:FC.green,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
  hesapBtnA:{background:FC.redL,borderColor:FC.red+"55",color:FC.red},
  footer:{marginTop:12,paddingTop:10,borderTop:`1px solid ${FC.border}`,display:"flex",justifyContent:"space-between",fontSize:10},
};

// ─── Hesaplayıcı stilleri ────────────────────────────────────────────────────
const hs = {
  wrap:{background:FC.card,borderRadius:12,padding:"14px",marginTop:10,animation:"fi 0.2s ease",border:`1px solid ${FC.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3},
  fonBadge:{background:FC.greenL,color:FC.green,fontWeight:800,fontSize:13,letterSpacing:0.8,padding:"2px 8px",borderRadius:6,border:`1px solid ${FC.green}33`},
  title:{fontSize:13,fontWeight:600,color:FC.text},
  kapat:{background:"none",border:"none",color:FC.sub,cursor:"pointer",fontSize:14,fontFamily:"inherit"},
  fonAd:{fontSize:10,color:FC.sub,marginBottom:10,lineHeight:1.4},
  toggleRow:{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"},
  toggleGroup:{display:"flex",background:"#E5E5EA",borderRadius:8,padding:2,gap:0},
  tBtn:{padding:"5px 14px",border:"none",background:"none",color:FC.sub,fontSize:12,fontWeight:500,cursor:"pointer",borderRadius:6,fontFamily:"inherit"},
  tBtnAktif:{background:FC.card,color:FC.green,fontWeight:700,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"},
  tBtnTuzel:{background:FC.card,color:FC.orange,fontWeight:700,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"},
  badge:{fontSize:10,color:FC.sub,flexShrink:0},
  grid3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6},
  grp:{display:"flex",flexDirection:"column",gap:4},
  lbl:{fontSize:10,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600},
  iWrap:{display:"flex",alignItems:"center",background:"#F9F9FB",border:`1.5px solid ${FC.border}`,borderRadius:8,padding:"7px 10px",gap:4},
  inp:{flex:1,background:"none",border:"none",outline:"none",color:FC.text,fontSize:13,fontFamily:"inherit",fontVariantNumeric:"tabular-nums",width:0},
  suf:{fontSize:10,color:FC.sub2,flexShrink:0},
  nota:{fontSize:10,color:FC.sub2,marginBottom:8,minHeight:14},
  divider:{height:1,background:FC.border,margin:"8px 0"},
  kart:{background:FC.cardAlt,borderRadius:10,padding:"10px",border:`1px solid ${FC.border}`},
  kLbl:{fontSize:9,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4,fontWeight:600},
  kVal:{fontSize:15,fontWeight:700,fontVariantNumeric:"tabular-nums",marginBottom:2},
  kAlt:{fontSize:9,color:FC.sub},
  netBox:{background:FC.greenL,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,border:`1px solid ${FC.green}33`},
  netLbl:{fontSize:11,color:FC.green,fontWeight:600},
  netVal:{fontSize:17,fontWeight:800,color:FC.green,fontVariantNumeric:"tabular-nums"},
};


// ─── KATILIM FONU ARAÇLARI ───────────────────────────────────────────────────

function VadeliKatilim({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [gun,setGun]=useState("");
  const [oran,setOran]=useState("");
  const [doviz,setDoviz]=useState("TL");
  const [kaydedildi,setKaydedildi]=useState(false);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),G=parseInt(gun),rt=parseFloat(oran);
    if(!T||!G||!rt)return null;
    const gunlukOran=rt/100/365;
    const bf=T*gunlukOran*G;
    const sOran=doviz==="TL"?(G<=180?s.stopajTL_0_180:G<=365?s.stopajTL_181_365:s.stopajTL_365plus):s.stopajYP_tum;
    const stop=bf*(sOran/100);
    const nf=bf-stop;
    const nv=T+nf;
    const ey=(nf/T)/G*365*100;
    return{bf,stop,nf,nv,ey,sOran};
  },[tutar,gun,oran,doviz,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"TL Katılım"},{v:"USD",l:"USD Katılım"},{v:"EUR",l:"EUR Katılım"}]} value={doviz} onChange={setDoviz}/>
        <Field label="Katılım Tutarı" value={tutar} onChange={setTutar} suffix={doviz==="TL"?"₺":doviz==="USD"?"$":"€"}/>
        <Field label="Vade (Gün)" value={gun} onChange={setGun} suffix="Gün" hint="Örn: 32 gün, 91 gün, 182 gün, 365 gün"/>
        <Field label="Kâr Payı Oranı (Yıllık)" value={oran} onChange={setOran} suffix="%"/>
      </Card>
      {r&&<Card>
        <SecTitle>Sonuçlar</SecTitle>
        <RRow label="Brüt Kâr Payı" value={fmtTL(r.bf)}/>
        <RRow label={`Stopaj (%${fmtN(r.sOran)})`} value={`- ${fmtTL(r.stop)}`} sub accent={C.red}/>
        <RRow label="Net Kâr Payı" value={fmtTL(r.nf)} accent={C.green} big/>
        <RRow label="Vade Sonu Tutar" value={fmtTL(r.nv)} accent={C.blue} big/>
        <RRow label="Efektif Net Yıllık Kâr Payı %" value={`% ${fmtN(r.ey)}`} sub/>
        <button onClick={()=>{if(onGecmis&&r){onGecmis({modul:"Katılım Hesabı Getiri",tutar:fmtTL(parseFloat(tutar)),vade:gun+" Gün",oran:oran+"% (Brüt)",sonuc:fmtTL(r?.bf),netGetiri:fmtTL(r?.nf),aylikTaksit:"-",plan:[]});setKaydedildi(true);setTimeout(()=>setKaydedildi(false),2000);}}} style={{width:"100%",marginTop:6,marginBottom:2,padding:"10px",borderRadius:12,border:`1.5px solid ${kaydedildi?C.green:C.teal}`,background:kaydedildi?C.greenLight:C.tealLight,color:kaydedildi?C.green:C.teal,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
          {kaydedildi?"✅ Kaydedildi":"🕐 Geçmişe Kaydet"}
        </button>
        <RaporButon baslik="Katılım Hesabı Getiri Analizi" satirlar={[
          {label:"Brüt Kâr Payı", value:fmtTL(r.bf)},
          {label:`Stopaj (%${fmtN(r.sOran)})`, value:`- ${fmtTL(r.stop)}`},
          {label:"Net Kâr Payı", value:fmtTL(r.nf)},
          {label:"Vade Sonu Tutar", value:fmtTL(r.nv)},
          {label:"Efektif Net Yıllık %", value:`% ${fmtN(r.ey)}`},
        ]}/>
      </Card>}
    </div>
  );
}

function GetiridenAnapara({s}){
  const [hedefGetiri,setHedefGetiri]=useState("");
  const [gun,setGun]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");

  const r=useCallback(()=>{
    const G2=parseFloat(hedefGetiri),GUN=parseInt(gun),rt=parseFloat(oran);
    if(!G2||!GUN||!rt)return null;
    const go=tip==="yillik"?rt/100/365:rt/100;
    const sOran=GUN<=180?s.stopajTL_0_180:GUN<=365?s.stopajTL_181_365:s.stopajTL_365plus;
    const netOran=go*GUN*(1-sOran/100);
    const anapara=G2/netOran;
    const bf=anapara*go*GUN;
    const stop=bf*(sOran/100);
    return{anapara,bf,stop,netKarPayi:G2,sOran};
  },[hedefGetiri,gun,oran,tip,s])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"aylik",l:"Günlük %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Hedef Net Kâr Payı (₺)" value={hedefGetiri} onChange={setHedefGetiri} suffix="₺"/>
        <Field label="Vade (Gün)" value={gun} onChange={setGun} suffix="Gün"/>
        <Field label="Kâr Payı Oranı (Yıllık)" value={oran} onChange={setOran} suffix="%"/>
      </Card>
      {r&&<Card>
        <SecTitle>Gerekli Anapara</SecTitle>
        <RRow label="Gerekli Anapara" value={fmtTL(r.anapara)} accent={C.blue} big/>
        <RRow label="Brüt Kâr Payı" value={fmtTL(r.bf)}/>
        <RRow label={`Stopaj (%${fmtN(r.sOran)})`} value={`- ${fmtTL(r.stop)}`} sub accent={C.red}/>
        <RRow label="Net Kâr Payı" value={fmtTL(r.netKarPayi)} accent={C.green} big/>
      </Card>}
    </div>
  );
}

function OranAnalizi({s}){
  const [seg,setSeg]=useState("bireysel"); // bireysel | tuzel
  const [tutar,setTutar]=useState("");
  const [gun] = useState("1");
  const [netGetiri,setNetGetiri]=useState("");
  const [showLimits,setShowLimits]=useState(false);

  // ─── Bireysel CARI_TABLO ──────────────────────────────────────────────────
  const BIREYSEL_TABLO=[
    {min:10000,    max:24999,    cari:5000},
    {min:25000,    max:49999,    cari:7500},
    {min:50000,    max:99999,    cari:10000},
    {min:100000,   max:249999,   cari:25000},
    {min:250000,   max:499999,   cari:50000},
    {min:500000,   max:999999,   cari:100000},
    {min:1000000,  max:1999999,  cari:200000},
    {min:2000000,  max:2999999,  cari:300000},
    {min:3000000,  max:3999999,  cari:400000},
    {min:4000000,  max:4999999,  cari:500000},
    {min:5000000,  max:10000000, cari:750000},
    {min:10000000, max:Infinity, cari:2000000},
  ];

  // ─── Tüzel CARI_TABLO ─────────────────────────────────────────────────────
  const TUZEL_TABLO=[
    {min:100000,      max:250000,      cari:30000},
    {min:250001,      max:500000,      cari:60000},
    {min:500001,      max:1000000,     cari:120000},
    {min:1000001,     max:2500000,     cari:300000},
    {min:2500001,     max:5000000,     cari:600000},
    {min:5000001,     max:7500000,     cari:900000},
    {min:7500001,     max:10000000,    cari:1200000},
    {min:10000001,    max:20000000,    cari:2400000},
    {min:20000001,    max:50000000,    cari:6000000},
    {min:50000001,    max:100000000,   cari:12000000},
    {min:100000001,   max:500000000,   cari:60000000},
  ];

  const AKTIF_TABLO = seg==="bireysel" ? BIREYSEL_TABLO : TUZEL_TABLO;

  const getCariTutar=(v)=>{
    const V=parseFloat(v)||0;
    if(V<=0) return null;
    const b=AKTIF_TABLO.find(b=>V>=b.min&&V<=b.max);
    return b?b.cari:null;
  };

  const cariTutar=getCariTutar(tutar);
  const toplamPozisyon=cariTutar?(parseFloat(tutar)||0)+cariTutar:(parseFloat(tutar)||0);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),G=parseInt(gun),KP=parseFloat(netGetiri);
    if(!T||!G||!KP)return null;
    if(T<10000) return{limitAsim:true,altLimit:true};
    if(seg==="bireysel"&&T>100000000) return{limitAsim:true,ustLimit:true};
    const sOran=G<=180?s.stopajTL_0_180:G<=365?s.stopajTL_181_365:s.stopajTL_365plus;
    const netGunluk=(KP/T)/G*100;
    const brutGunluk=netGunluk/(1-sOran/100);
    return{brutYillik:brutGunluk*365,netYillik:netGunluk*365,sOran};
  },[tutar,gun,netGetiri,seg,s])();

  // ─── Tablo style helpers ──────────────────────────────────────────────────
  const thT=(bg)=>({padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:bg||"#1C3A5E",letterSpacing:"0.04em",textAlign:"left"});
  const tdT=(bold)=>({padding:"7px 10px",fontSize:12,borderBottom:"1px solid #E5E9F0",fontWeight:bold?700:400,fontFamily:bold?"monospace":"inherit"});
  const fmt=(n)=>new Intl.NumberFormat("tr-TR").format(n);

  // ─── Yeni müşteri limit tablosu (modal için) ─────────────────────────────
  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Limit Tablosu Modal */}
      {showLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>📋 {seg==="bireysel"?"Bireysel":"Tüzel"} Günlük Hesap İşlem Limitleri</span>
              <button onClick={()=>setShowLimits(false)} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 16px 28px"}}>
              {seg==="bireysel" ? (<>
                <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:C.blue,textTransform:"uppercase"}}>🆕 Yeni Müşteri</p>
                <div style={{background:"#F0F5FB",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>Hoş geldin süresi: <strong>45 gün</strong> · Kâr paylaşım oranı: <strong>99/1</strong></p>
                </div>
                <div style={{overflowX:"auto",marginBottom:18}}>
                  <table style={{borderCollapse:"collapse",width:"100%",minWidth:280}}>
                    <thead><tr>
                      <th style={thT()}>Bakiye Bandı</th>
                      <th style={{...thT(),textAlign:"right"}}>Cari Tutar</th>
                    </tr></thead>
                    <tbody>
                      {[{b:"10.000–24.999",c:5000},{b:"25.000–49.999",c:7500},{b:"50.000–99.999",c:10000},
                        {b:"100.000–249.999",c:25000},{b:"250.000–499.999",c:50000},{b:"500.000–999.999",c:100000},
                        {b:"1.000.000–1.999.999",c:200000},{b:"2.000.000–2.999.999",c:300000},
                        {b:"3.000.000–3.999.999",c:400000},{b:"4.000.000–4.999.999",c:500000},
                        {b:"5.000.000–10.000.000",c:750000},
                      ].map((r,i)=>(
                        <tr key={i} style={{background:i%2===0?"#fff":"#F8FAFB"}}>
                          <td style={tdT(false)}>{r.b} ₺</td>
                          <td style={{...tdT(true),textAlign:"right"}}>{fmt(r.c)} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:C.green,textTransform:"uppercase"}}>👤 Mevcut Müşteri</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>
                    <thead><tr>
                      <th style={thT("#1A5C4A")}>Bakiye Bandı</th>
                      <th style={{...thT("#1A5C4A"),textAlign:"right"}}>Cari Tutar</th>
                      <th style={{...thT("#1A5C4A"),textAlign:"right"}}>Oran</th>
                    </tr></thead>
                    <tbody>
                      {[{b:"10.000–24.999",c:5000,o:"85/15"},{b:"25.000–49.999",c:7500,o:"85/15"},
                        {b:"50.000–99.999",c:10000,o:"85/15"},{b:"100.000–249.999",c:25000,o:"85/15"},
                        {b:"250.000–499.999",c:50000,o:"85/15"},{b:"500.000–999.999",c:100000,o:"85/15"},
                        {b:"1.000.000–1.999.999",c:200000,o:"85/15"},{b:"2.000.000–2.999.999",c:300000,o:"85/15"},
                        {b:"3.000.000–3.999.999",c:400000,o:"85/15"},{b:"4.000.000–4.999.999",c:500000,o:"85/15"},
                        {b:"5.000.000–10.000.000",c:750000,o:"90/10"},{b:"10.000.000+",c:2000000,o:"80/20"},
                      ].map((r,i)=>(
                        <tr key={i} style={{background:i%2===0?"#fff":"#F8FAFB"}}>
                          <td style={tdT(false)}>{r.b} ₺</td>
                          <td style={{...tdT(true),textAlign:"right"}}>{fmt(r.c)} ₺</td>
                          <td style={{...tdT(true),textAlign:"right",color:C.green}}>{r.o}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>) : (<>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:C.orange,textTransform:"uppercase"}}>🏢 Tüzel Müşteri</p>
              <div style={{background:"#FFF8F0",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                <p style={{margin:0,fontSize:10,color:C.sub}}>Standart oran: <strong>95/5</strong></p>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>
                  <thead><tr>
                    <th style={thT("#7A5000")}>Bakiye Bandı</th>
                    <th style={{...thT("#7A5000"),textAlign:"right"}}>Cari Tutar</th>
                  </tr></thead>
                  <tbody>
                    {TUZEL_TABLO.map((b,i)=>(
                      <tr key={i} style={{background:i%2===0?"#fff":"#FFF8F0"}}>
                        <td style={tdT(false)}>{fmt(b.min)} – {b.max===Infinity?fmt(b.min)+"+":fmt(b.max)} ₺</td>
                        <td style={{...tdT(true),textAlign:"right"}}>{fmt(b.cari)} ₺</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      <Card>
        <Seg options={[{v:"bireysel",l:"Bireysel"},{v:"tuzel",l:"Tüzel"}]} value={seg} onChange={v=>{setSeg(v);setTutar("");setNetGetiri("");}}/>
        <Field label="Günlük Hesap Bakiyesi" value={tutar} onChange={setTutar} suffix="₺"/>
        <button onClick={()=>setShowLimits(true)} style={{width:"100%",marginBottom:12,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> Günlük Hesap İşlem Limitlerini Görüntüle
        </button>

        {/* Cari Bloke Tutarı */}
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Cari Bloke Tutarı</label>
          {cariTutar!=null?(
            <div style={{padding:"11px 40px 11px 13px",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"monospace",color:"#1C1C1E",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{fmt(cariTutar)}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.blue}}>₺</span>
            </div>
          ):(
            <div style={{padding:"11px 13px",background:"#F0F0F2",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:13,color:C.sub}}>
              {parseFloat(tutar)>0?"Tablo kapsamı dışı":"Bakiye girilince otomatik hesaplanır"}
            </div>
          )}
        </div>

        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Vade (Gün)</label>
          <div style={{padding:"11px 40px 11px 13px",background:"#F0F0F2",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"monospace",color:C.sub,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>1</span>
            <span style={{fontSize:13,fontWeight:700,color:C.blue}}>Gün</span>
          </div>
        </div>
        <Field label="Net Kâr Payı" value={netGetiri} onChange={setNetGetiri} suffix="₺" hint="Aldığınız net kâr payı tutarı"/>
      </Card>

      {r?.limitAsim&&<div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",marginBottom:10,border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 2px",fontSize:14,fontWeight:800,color:C.red}}>⛔ {r.altLimit?"Asgari Tutar":"Azami Tutar"} Aşıldı</p>
        <p style={{margin:0,fontSize:12,color:C.red}}>{r.altLimit?"Minimum açılış tutarı 10.000 ₺'dir.":"Maksimum açılış tutarı 100.000.000 ₺'dir."}</p>
      </div>}

      {r&&!r.limitAsim&&<Card>
        <SecTitle>Oran Analizi</SecTitle>
        <RRow label="Brüt Yıllık Basit Oran" value={`% ${fmtN(r.brutYillik)}`} big/>
        <RRow label="Net Yıllık Oran" value={`% ${fmtN(r.netYillik)}`} accent={C.green}/>
        <RRow label="Stopaj Oranı" value={`% ${fmtN(r.sOran)}`} sub/>
        {cariTutar&&<>
          <div style={{height:1,background:C.border,margin:"8px 0"}}/>
          <RRow label="Günlük Hesap Bakiyesi" value={`₺${fmt(parseFloat(tutar))}`} sub/>
          <RRow label="Cari Bloke Tutarı" value={`₺${fmt(cariTutar)}`} sub/>
          <RRow label="Toplam Pozisyon" value={`₺${fmt(toplamPozisyon)}`} accent={C.purple} big/>
          <RRow label="Toplam Pozisyon Bazlı Brüt Yıllık Oran"
            value={`% ${fmtN((parseFloat(netGetiri)/toplamPozisyon*100/(1-r.sOran/100))*365)}`}
            accent={C.teal} big/>
          <RRow label="Toplam Pozisyon Bazlı Net Yıllık Oran"
            value={`% ${fmtN((parseFloat(netGetiri)/toplamPozisyon*100)*365)}`}
            accent={C.green} big/>
        </>}
      </Card>}
    </div>
  );
}

function OdemePlani({plan, bsmvOran, kkdfOran, onClose, showKomisyon, basitOran, efektifOran, anaparaTutar}){
  const bsmv=bsmvOran||0, kkdf=kkdfOran||0;
  const hasBsmv=bsmv>0, hasKkdf=kkdf>0, hasTax=(bsmv+kkdf)>0;
  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const now=new Date();
  const getTarih=(idx)=>{const tot=now.getMonth()+1+idx;return MONTHS[tot%12]+' '+(now.getFullYear()+Math.floor(tot/12));};
  const totTaksit=plan.reduce((a,r)=>a+r.toplam,0);
  const totAna=plan.reduce((a,r)=>a+r.anapara,0);
  const totKar=plan.reduce((a,r)=>a+r.karPayi,0);
  const totBsmv=plan.reduce((a,r)=>a+r.karPayi*(bsmv/100),0);
  const totKkdf=plan.reduce((a,r)=>a+r.karPayi*(kkdf/100),0);
  const thStyle={padding:"5px 4px",color:"#fff",fontWeight:700,fontSize:9,whiteSpace:"nowrap",textAlign:"right",background:"#1C3A5E",letterSpacing:"0.04em"};
  const tdStyle=(color)=>({padding:"5px 4px",fontFamily:"monospace",fontSize:10,textAlign:"right",color:color||"#1C1C1E",whiteSpace:"nowrap"});
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:C.label}}>📅 Aylık Ödeme Planı</span>
          <button onClick={onClose} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{flex:"1 1 40%",padding:"8px 10px",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>ANAPARA</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.blue}}>{fmtTL(anaparaTutar||totAna)}</p>
          </div>
          <div style={{flex:"1 1 40%",padding:"8px 10px",borderBottom:`1px solid ${C.border}`}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>KÂR PAYI</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.orange}}>{fmtTL(totKar)}</p>
          </div>
          <div style={{flex:"1 1 40%",padding:"8px 10px",borderRight:hasTax||showKomisyon?`1px solid ${C.border}`:"none"}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>TOPLAM TAKSİT</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.blue}}>{fmtTL(totTaksit)}</p>
          </div>
          {hasTax&&!showKomisyon&&<div style={{flex:"1 1 40%",padding:"8px 10px"}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>VERGİ</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.red}}>{fmtTL(totBsmv+totKkdf)}</p>
          </div>}
          {showKomisyon&&<div style={{flex:"1 1 40%",padding:"8px 10px"}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:"#9C3060",letterSpacing:"0.06em"}}>KOMİSYON</p>
            <p style={{margin:"2px 0 0",fontSize:12,fontWeight:800,color:"#9C3060"}}>{fmtTL(plan.reduce((a,r)=>a+(r.komisyon||0),0))}</p>
          </div>}
        </div>
        {(basitOran||efektifOran)&&<div style={{display:"flex",gap:1,background:C.border,flexShrink:0}}>
          {basitOran>0&&<div style={{flex:1,padding:"7px 12px",background:C.card}}>
            <p style={{margin:0,fontSize:9,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>BASİT YILLIK ORAN</p>
            <p style={{margin:"1px 0 0",fontSize:13,fontWeight:800,color:C.blue}}>% {fmtN(basitOran,2)}</p>
          </div>}
          {efektifOran>0&&<div style={{flex:1,padding:"7px 12px",background:C.card}}>
            <p style={{margin:0,fontSize:9,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>EFEKTİF YILLIK ORAN</p>
            <p style={{margin:"1px 0 0",fontSize:13,fontWeight:800,color:C.green}}>% {fmtN(efektifOran,2)}</p>
          </div>}
        </div>}
        <div style={{flex:1,overflow:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:hasTax?520:400}}>
            <thead>
              <tr>
                <th style={{...thStyle,textAlign:"left"}}>No</th>
                <th style={{...thStyle,textAlign:"left"}}>Tarih</th>
                <th style={thStyle}>Taksit</th>
                <th style={thStyle}>Anapara</th>
                <th style={thStyle}>Kâr Payı</th>
                {hasBsmv&&<th style={thStyle}>BSMV%{bsmv}</th>}
                {hasKkdf&&<th style={thStyle}>KKDF%{kkdf}</th>}
                <th style={thStyle}>Kalan</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((row,i)=>(
                <tr key={i} style={{background:i%2===0?"#fff":"#F6F8FA",borderBottom:`1px solid ${C.border}`}}>
                  <td style={{...tdStyle(C.blue),textAlign:"left",fontWeight:700}}>{row.ay}</td>
                  <td style={{...tdStyle(C.label),textAlign:"left",fontFamily:"inherit",fontSize:11}}>{getTarih(i)}</td>
                  <td style={{...tdStyle(),fontWeight:700}}>{fmtN(row.toplam,2)}</td>
                  <td style={tdStyle(C.sub)}>{fmtN(row.anapara,2)}</td>
                  <td style={tdStyle(C.orange)}>{fmtN(row.karPayi,2)}</td>
                  {hasBsmv&&<td style={tdStyle(C.red)}>{fmtN(row.karPayi*(bsmv/100),2)}</td>}
                  {hasKkdf&&<td style={tdStyle("#9C3060")}>{fmtN(row.karPayi*(kkdf/100),2)}</td>}
                  <td style={tdStyle(C.sub)}>{fmtN(row.bakiye,2)}</td>
                </tr>
              ))}
              <tr style={{background:"#EBF3FB",borderTop:`2px solid ${C.blue}`}}>
                <td style={{...tdStyle(C.blue),textAlign:"left",fontWeight:800}}>∑</td>
                <td style={{...tdStyle(C.label),textAlign:"left",fontFamily:"inherit",fontWeight:800}}>TOPLAM</td>
                <td style={{...tdStyle(),fontWeight:800}}>{fmtN(totTaksit,2)}</td>
                <td style={{...tdStyle(C.sub),fontWeight:800}}>{fmtN(totAna,2)}</td>
                <td style={{...tdStyle(C.orange),fontWeight:800}}>{fmtN(totKar,2)}</td>
                {hasBsmv&&<td style={{...tdStyle(C.red),fontWeight:800}}>{fmtN(totBsmv,2)}</td>}
                {hasKkdf&&<td style={{...tdStyle("#9C3060"),fontWeight:800}}>{fmtN(totKkdf,2)}</td>}
                <td style={{...tdStyle(C.sub),fontWeight:800}}>0,00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function hesaplaOdemePlani(T, V, ao, bsmvOran, kkdfOran){
  const bsmv=(bsmvOran||0)/100;
  const kkdf=(kkdfOran||0)/100;
  const vergiOran=bsmv+kkdf;

  // Net PMT (anapara + kâr payı) - sabit
  const pmt = ao===0 ? T/V : T*ao/(1-Math.pow(1+ao,-V));
  const pmtFixed = Math.round(pmt*100)/100;

  // Sabit vergi: ilk ay kâr payı üzerinden — her ay aynı toplam taksit için
  const ilkAyKarPayi = Math.round(T*ao*100)/100;
  const sabitVergi = Math.round(ilkAyKarPayi*vergiOran*100)/100;
  // TOPLAM SABİT TAKSİT = her ay aynı
  const toplamSabitTaksit = Math.round((pmtFixed+sabitVergi)*100)/100;

  const plan=[];
  let bakiye=Math.round(T*100)/100;

  for(let i=1;i<=V;i++){
    const karPayi = Math.round(bakiye*ao*100)/100;
    const anapara = Math.round((pmtFixed-karPayi)*100)/100;
    const vergi   = Math.round(karPayi*vergiOran*100)/100;
    bakiye = Math.max(0, Math.round((bakiye-anapara)*100)/100);
    plan.push({ay:i, karPayi, anapara, vergi,
      toplam: toplamSabitTaksit,  // her ay SABİT
      bakiye});
  }
  // toplamSabitTaksit'i dışarı da döndür
  plan._toplamSabitTaksit = toplamSabitTaksit;
  return plan;
}

// ─── RAPOR / PAYLAŞ ──────────────────────────────────────────────────────────
// ─── RAPOR ÖNİZLEME + PAYLAŞ ────────────────────────────────────────────────
function RaporModal({baslik, satirlar, plan, onClose, showKdv=false, bsmvOran=0, kkdfOran=0}){
  const [yukleniyor, setYukleniyor] = useState(false);
  const tarih = new Date().toLocaleString("tr-TR");
  const fmt=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  const pdfOlusturVePaylas = async () => {
    setYukleniyor(true);
    try {
      // Geçici div oluştur — rapor HTML'i
      const div = document.createElement("div");
      div.style.cssText = "position:fixed;left:-9999px;top:0;width:595px;background:#fff;font-family:Arial,sans-serif;padding:0;";
      document.body.appendChild(div);

      const planSatirlari = plan && plan.length > 0 ? plan.filter(r=>r&&!r._toplamSabitTaksit) : [];
      const totTaksit = planSatirlari.reduce((s,r)=>s+(r.taksit||r.toplam||0),0);
      const totKP = planSatirlari.reduce((s,r)=>s+(r.karPayi||r.faiz||0),0);
      const totAna = planSatirlari.reduce((s,r)=>s+(r.anapara||0),0);
      const totKDV = planSatirlari.reduce((s,r)=>s+(r.kdvTutar||r.vergi||0),0);

      div.innerHTML = `
        <div style="background:#1C3A5E;padding:20px 24px 16px;">
          <div style="font-size:18px;color:#fff;font-weight:800;margin-bottom:4px;">${baslik}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.65);">${tarih}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">Vakıf Katılım Bankası — Fon Fiyatlama Müdürlüğü</div>
        </div>
        <div style="padding:0;">
          ${satirlar.filter(s=>s?.label).map((s,i)=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:${s.big?"11px":"8px"} 24px;background:${s.big?"#EBF3FB":i%2===0?"#FAFBFC":"#fff"};border-bottom:1px solid #F0F0F0;">
              <span style="font-size:${s.big?12:11}px;color:${s.big?"#1C3A5E":"#6B7280"};font-weight:${s.big?700:500};">${s.label}</span>
              <span style="font-size:${s.big?14:12}px;color:${s.big?"#1C3A5E":"#1a1a1a"};font-weight:${s.big?900:600};font-family:monospace;">${s.value}</span>
            </div>`).join("")}
        </div>
        ${planSatirlari.length>0?`
        <div style="margin-top:4px;">
          <div style="background:#1C3A5E;padding:9px 24px;">
            <span style="font-size:11px;font-weight:700;color:#fff;">ÖDEME PLANI — ${planSatirlari.length} TAKSİT</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:8px;">
            <thead>
              <tr style="background:#EBF3FB;">
                <th style="padding:5px 4px;text-align:center;color:#1C3A5E;font-weight:700;border-bottom:1px solid #D1E0EF;">#</th>
                ${(showKdv?["Taksit","Kâr Payı","Anapara","KDV","Kalan"]:["Taksit","Kâr Payı","Anapara","BSMV","KKDF","Kalan"]).map(h=>`<th style="padding:5px 4px;text-align:right;color:#1C3A5E;font-weight:700;border-bottom:1px solid #D1E0EF;">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${planSatirlari.map((r,i)=>{
                const vals = showKdv
                  ? [r.taksit||r.toplam, r.karPayi||r.faiz, r.anapara, r.kdvTutar||r.vergi||0, r.bakiye]
                  : [r.taksit||r.toplam, r.karPayi||r.faiz, r.anapara, (r.karPayi||0)*bsmvOran/100, (r.karPayi||0)*kkdfOran/100, r.bakiye];
                return `<tr style="background:${i%2===0?"#F8FAFB":"#fff"};border-bottom:1px solid #F0F0F0;">
                  <td style="padding:4px;text-align:center;color:#6B7280;font-weight:600;">${r.ay||i+1}</td>
                  ${vals.map(v=>`<td style="padding:4px;text-align:right;font-family:monospace;color:#1a1a1a;">${fmt(v)}</td>`).join("")}
                </tr>`;
              }).join("")}
              <tr style="background:#1C3A5E;">
                <td style="padding:5px 4px;text-align:center;color:#fff;font-weight:800;font-size:9px;">∑</td>
                ${(showKdv
                  ? [totTaksit,totKP,totAna,totKDV,"—"]
                  : [totTaksit,totKP,totAna,planSatirlari.reduce((s,r)=>s+(r.karPayi||0)*bsmvOran/100,0),planSatirlari.reduce((s,r)=>s+(r.karPayi||0)*kkdfOran/100,0),"—"]
                ).map(v=>`<td style="padding:5px 4px;text-align:right;color:#fff;font-weight:800;font-family:monospace;font-size:8px;">${typeof v==="number"?fmt(v):v}</td>`).join("")}
              </tr>
            </tbody>
          </table>
        </div>`:""}
        <div style="margin:16px 24px;padding:12px 16px;background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:4px;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="font-size:16px;flex-shrink:0;">⚠️</span>
            <p style="margin:0;font-size:10px;color:#374151;font-style:italic;line-height:1.7;">
              Bu hesaplamalar yalnızca bilgilendirme amaçlıdır; kesin teklif, resmi belge veya hukuki taahhüt niteliği taşımaz. Nihai oranlar ve koşullar için yetkili biriminizle iletişime geçiniz.
            </p>
          </div>
        </div>
      `;

      // window.print() ile PDF
      const printWindow = window.open("", "_blank", "width=650,height=900");
      if(!printWindow){ document.body.removeChild(div); setYukleniyor(false); return; }
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${baslik}</title><style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,Helvetica,sans-serif;background:#fff;}
        @media print{@page{margin:0;size:A4;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style></head><body>${div.innerHTML}</body></html>`);
      printWindow.document.close();
      document.body.removeChild(div);

      // Kısa bekle sonra print dialog aç
      setTimeout(()=>{
        printWindow.focus();
        printWindow.print();
        // iOS'ta print dialog = paylaş menüsü (PDF kaydet, Mail, WhatsApp vs.)
        setTimeout(()=>{ try{ printWindow.close(); }catch(e){} }, 3000);
      }, 600);

    } catch(e) {
      alert("PDF oluşturulurken hata: " + e.message);
    }
    setYukleniyor(false);
  };

  // Ana modal
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:C.label}}>📤 Rapor / Paylaş</span>
          <button onClick={onClose} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>
          {satirlar.filter(s=>s?.label).map((s,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.sub}}>{s.label}</span>
              <span style={{fontSize:13,fontWeight:s.big?800:600,color:s.big?C.blue:C.label}}>{s.value}</span>
            </div>
          ))}
          {plan&&plan.length>0&&(
            <div style={{marginTop:12,background:C.blueLight,borderRadius:10,padding:"10px 12px"}}>
              <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>📋 {plan.length} satır ödeme planı PDF'e dahil edilecek</p>
            </div>
          )}
        </div>
        <div style={{padding:"12px 18px 28px",flexShrink:0}}>
          <button onClick={pdfOlusturVePaylas} disabled={yukleniyor} style={{
            width:"100%",padding:"15px",borderRadius:14,border:"none",
            background:yukleniyor?"#6B7280":C.blue,color:"#fff",
            fontWeight:800,fontSize:16,cursor:yukleniyor?"not-allowed":"pointer",
            boxShadow:"0 4px 14px rgba(28,58,94,0.3)"
          }}>
            {yukleniyor ? "⏳ Hazırlanıyor..." : "📄 PDF Oluştur & Paylaş"}
          </button>
          <p style={{margin:"10px 0 0",fontSize:11,color:"#9CA3AF",textAlign:"center",lineHeight:1.5}}>
            PDF önizleme açılır → Paylaş butonundan Mail, WhatsApp veya Dosyalar'a kaydedebilirsiniz
          </p>
        </div>
      </div>
    </div>
  );
}

function RaporButon({baslik, satirlar, plan, showKdv=false, bsmvOran=0, kkdfOran=0}){
  const [show, setShow] = useState(false);
  return(
    <>
      {show && <RaporModal baslik={baslik} satirlar={satirlar} plan={plan} onClose={()=>setShow(false)} showKdv={showKdv} bsmvOran={bsmvOran} kkdfOran={kkdfOran}/>}
      <button onClick={()=>setShow(true)} style={{
        width:"100%",marginTop:8,padding:"12px",borderRadius:12,
        border:`1.5px solid ${C.purple}`,background:C.purpleLight,
        color:C.purple,fontWeight:700,fontSize:14,cursor:"pointer"
      }}>
        📤 Rapor / Paylaş
      </button>
    </>
  );
}

// ─── KALAN ANAPARA MODAL (ceza yok) ────────────────────────────────────────
function KalanAnaparaModal({plan, onClose, showCeza=false}){
  const [kapamaAyi, setKapamaAyi] = useState("");
  const ayNum = parseInt(kapamaAyi)||0;
  const row = plan && ayNum>=1 && ayNum<=plan.length ? plan[ayNum-1] : null;
  const kalanBakiye = row ? row.bakiye : null;
  const odenenToplam = plan ? plan.slice(0,ayNum).reduce((a,r)=>a+r.toplam,0) : 0;
  // Erken kapama cezası: kalan vade ≤36 ay → max %1, >36 ay → max %2
  const kalanVade = plan ? plan.length - ayNum : 0;
  const cezaOran = showCeza ? (kalanVade <= 36 ? 1 : 2) : 0;
  const cezaTutar = kalanBakiye ? Math.round(kalanBakiye * cezaOran / 100 * 100) / 100 : 0;
  const toplamKapama = kalanBakiye ? kalanBakiye + cezaTutar : 0;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",overflowY:"auto",padding:"20px 18px 36px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:16,fontWeight:800,color:C.label}}>⚡ Erken Kapama</span>
          <button onClick={onClose} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{background:C.blueLight,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          {showCeza
            ? <p style={{margin:0,fontSize:12,color:C.blue,lineHeight:1.5}}>
                Kalan vade ≤ 36 ay ise max <strong>%1</strong>, 36 aydan uzun ise max <strong>%2</strong> erken kapama cezası uygulanabilir.
              </p>
            : <p style={{margin:0,fontSize:12,color:C.blue,lineHeight:1.5}}>
                Bu finansman türünde erken kapama ücreti uygulanmaz. Kalan anapara tutarı ile kapatılır.
              </p>}
        </div>
        <Field label="Kaçıncı ayda kapanıyor?" value={kapamaAyi} onChange={setKapamaAyi} suffix="Ay" hint={plan?`Toplam vade: ${plan.length} ay`:""}/>
        {row&&(
          <>
            <div style={{background:C.blueLight,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
              <p style={{margin:"0 0 4px",fontSize:12,color:C.sub,fontWeight:600}}>{ayNum}. AY SONU KALAN ANAPARA</p>
              <p style={{margin:0,fontSize:28,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{fmtTL(kalanBakiye)}</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{background:"#F9F9FB",borderRadius:10,padding:"11px 13px"}}>
                <p style={{margin:"0 0 2px",fontSize:11,color:C.sub,fontWeight:600}}>Ödenen Taksit</p>
                <p style={{margin:0,fontSize:17,fontWeight:800,color:C.label}}>{ayNum} ay</p>
              </div>
              <div style={{background:"#F9F9FB",borderRadius:10,padding:"11px 13px"}}>
                <p style={{margin:"0 0 2px",fontSize:11,color:C.sub,fontWeight:600}}>Kalan Vade</p>
                <p style={{margin:0,fontSize:17,fontWeight:800,color:C.orange}}>{plan.length-ayNum} ay</p>
              </div>
            </div>
            {showCeza&&cezaTutar>0&&(
              <div style={{background:"#FFF8F0",borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${C.orange}`}}>
                <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.orange}}>Erken Kapama Cezası (Max %{cezaOran})</p>
                <p style={{margin:0,fontSize:20,fontWeight:900,color:C.orange,fontFamily:"monospace"}}>{fmtTL(cezaTutar)}</p>
                <p style={{margin:"3px 0 0",fontSize:10,color:C.sub}}>Kalan vade: {kalanVade} ay → %{cezaOran} azami oran</p>
              </div>
            )}
            <div style={{background:C.greenLight,borderRadius:12,padding:"14px 16px",border:`1.5px solid ${C.green}`}}>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:C.green}}>
                ✅ Erken Kapama Tutarı
              </p>
              <p style={{margin:"6px 0 0",fontSize:24,fontWeight:900,color:C.green,fontFamily:"monospace"}}>
                {fmtTL(showCeza?toplamKapama:kalanBakiye)}
              </p>
              <p style={{margin:"4px 0 0",fontSize:11,color:C.sub}}>
                {showCeza&&cezaTutar>0
                  ? `Kalan anapara ${fmtTL(kalanBakiye)} + ceza ${fmtTL(cezaTutar)}`
                  : `Ödenen ${ayNum} taksit (${fmtTL(odenenToplam)}) + kalan anapara — ceza uygulanmaz`}
              </p>
            </div>
          </>
        )}
        {kapamaAyi&&!row&&(
          <div style={{background:"#FEF2F2",borderRadius:10,padding:"11px 14px"}}>
            <p style={{margin:0,fontSize:13,color:C.red,fontWeight:700}}>⛔ Geçersiz ay — 1 ile {plan?.length||"?"} arasında girin</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── ERKEN KAPAMA MODALI ─────────────────────────────────────────────────────
function KonutFinansman({s,onGecmis})/* v2 */{
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [deger,setDeger]=useState("");
  const [enerji,setEnerji]=useState("AB");
  const [ilkEv,setIlkEv]=useState(true);
  const [showLimits,setShowLimits]=useState(false);
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI_KULL_BIR=0.50; // Bireysel azami %0,50 (binde 5)

  // LTV tablosu — Tablo 1: İlk Ev (Ailenin farklı konutu YOK)
  const getLTV_ilkEv=(d,e)=>{
    if(d<=5000000)  return e==="AB"?90:e==="C"?80:70;
    if(d<=7000000)  return e==="AB"?80:e==="C"?70:60;
    if(d<=10000000) return e==="AB"?70:e==="C"?60:50;
    if(d<=20000000) return e==="AB"?50:e==="C"?40:30;
    return e==="AB"?40:e==="C"?30:20;
  };
  // LTV tablosu — Tablo 2: İkinci Ev (Ailenin farklı konutu VAR)
  const getLTV_ikinciEv=(d,e)=>{
    if(d<=5000000)  return e==="AB"?22.5:e==="C"?20:17.5;
    if(d<=7000000)  return e==="AB"?20:e==="C"?17.5:15;
    if(d<=10000000) return e==="AB"?17.5:e==="C"?15:12.5;
    if(d<=20000000) return e==="AB"?12.5:e==="C"?10:7.5;
    return e==="AB"?10:e==="C"?7.5:5;
  };
  const getLTV=(d,e)=>ilkEv?getLTV_ilkEv(d,e):getLTV_ikinciEv(d,e);

  const prevVadeRefK=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRefK.current){
      prevVadeRefK.current=vade;
      const V=parseInt(vade);
      if(V>0){
        const azami=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
        setKullKomisyon(fmtN(azami,4).replace(",","."));
      }
    }
  },[vade]);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt)return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    if(deger){
      const D=parseFloat(deger);
      const maxLTV=getLTV(D,enerji);
      const maxFin=Math.round(D*(maxLTV/100));
      if(T>maxFin) return{ltvAsim:true,maxFin,maxLTV,gercekLTV:(T/D)*100};
    }
    // İlk evde BSMV ve KKDF yok
    const bsmvR=ilkEv?0:s.bireyselBSMV;
    const kkdfR=0; // Konut finansmanında KKDF uygulanmaz (ilk ev veya ikinci ev)
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(bsmvR/100);
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const musteriFark=toplamKarPayi+bsmvTL+kkdfTL;
    const ltvSonuc=deger?{gercekLTV:(T/parseFloat(deger))*100,maxLTV:getLTV(parseFloat(deger),enerji)}:null;
    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVadeMaliyet=Math.round(aylikTaksit*V*100)/100;
    const azamiKull=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azamiKull);
    const kullAsim=kullOran>azamiKull;
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;
    // Efektif yıllık maliyet (bisection)
    const KonutFinansman_taksitBrut = pmt;
    const KonutFinansman_Tnet = T - kullUcret;
    let KonutFinansman_efAylik=0;
    if(KonutFinansman_Tnet>0&&V>0&&KonutFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=KonutFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>KonutFinansman_Tnet)lo=mid;else hi=mid;
      }
      KonutFinansman_efAylik=(lo+hi)/2;
    }
    const KonutFinansman_efYil=KonutFinansman_efAylik>0?Math.round((Math.pow(1+KonutFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:KonutFinansman_efYil,pmt,aylikTaksit,toplamNet,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,ltvSonuc,plan,bsmvR,kkdfR,kullUcret,kullOranUyg,kullAsim,azamiKull};
  },[tutar,vade,oran,tip,deger,enerji,ilkEv,kullKomisyon,s])();


  const degerNum=parseFloat(deger)||0;
  const maxLTV=getLTV(degerNum,enerji);

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>🏠 Konut Kullandırım Limitleri</span>
              <button onClick={()=>setShowLimits(false)} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"12px 16px 24px"}}>
              {[{baslik:"Ailenin Farklı Bir Konutu MEVCUT DEĞİLSE (İlk Ev)",rows:[
                  {deger:"≤ 5 Milyon ₺",ab:"% 90",c:"% 80",diger:"% 70"},
                  {deger:"5M – 7 Milyon ₺",ab:"% 80",c:"% 70",diger:"% 60"},
                  {deger:"7M – 10 Milyon ₺",ab:"% 70",c:"% 60",diger:"% 50"},
                  {deger:"10M – 20 Milyon ₺",ab:"% 50",c:"% 40",diger:"% 30"},
                  {deger:"> 20 Milyon ₺",ab:"% 40",c:"% 30",diger:"% 20"},
                ]},
                {baslik:"Ailenin Farklı Bir Konutu MEVCUT İSE (İkinci Ev)",rows:[
                  {deger:"≤ 5 Milyon ₺",ab:"% 22,5",c:"% 20",diger:"% 17,5"},
                  {deger:"5M – 7 Milyon ₺",ab:"% 20",c:"% 17,5",diger:"% 15"},
                  {deger:"7M – 10 Milyon ₺",ab:"% 17,5",c:"% 15",diger:"% 12,5"},
                  {deger:"10M – 20 Milyon ₺",ab:"% 12,5",c:"% 10",diger:"% 7,5"},
                  {deger:"> 20 Milyon ₺",ab:"% 10",c:"% 7,5",diger:"% 5"},
                ]},
              ].map((tablo,ti)=>(
                <div key={ti} style={{marginBottom:16}}>
                  <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:ti===0?C.green:C.orange}}>{tablo.baslik}</p>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{background:"#1C3A5E"}}>
                      {["Konut Değeri","A-B Enerji","C Enerji","Diğer"].map((h,i)=>(
                        <th key={i} style={{padding:"5px 6px",color:"#fff",fontWeight:700,textAlign:i>0?"center":"left"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{tablo.rows.map((r,i)=>(
                      <tr key={i} style={{background:i%2===0?"#F5F7FA":"#fff"}}>
                        <td style={{padding:"5px 6px",fontWeight:600,color:C.label}}>{r.deger}</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:C.blue,fontWeight:700}}>{r.ab}</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:C.sub}}>{r.c}</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:C.sub}}>{r.diger}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={r.bsmvR} kkdfOran={r.kkdfR} onClose={()=>setShowPlan(false)} showKomisyon={r.kullUcret>0} basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)} showCeza={true}/>}
      <Card>
        {/* İlk Ev Toggle */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",background:ilkEv?C.greenLight:"#F9F9FB",borderRadius:10,border:`1px solid ${ilkEv?C.green:C.border}`}}>
          <div onClick={()=>setIlkEv(!ilkEv)} style={{width:44,height:26,borderRadius:13,background:ilkEv?C.green:"#D1D1D6",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:ilkEv?21:3,width:20,height:20,borderRadius:10,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}}/>
          </div>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:ilkEv?C.green:C.label}}>{ilkEv?"✅ İlk Evim (Aile Konutu Yok)":"İkinci Ev (Aile Konutu Var)"}</p>
            <p style={{margin:0,fontSize:11,color:C.sub}}>{ilkEv?"BSMV/KKDF yok · Yüksek LTV (Tablo 1)":"BSMV uygulanır · Düşük LTV (Tablo 2)"}</p>
          </div>
        </div>
        <button onClick={()=>setShowLimits(true)} style={{width:"100%",marginBottom:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> LTV Limitlerini Görüntüle
        </button>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Konut Değeri (LTV için)" value={deger} onChange={setDeger} suffix="₺"/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        {deger&&<>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:6}}>Enerji Sınıfı</label>
          <Seg options={[{v:"AB",l:"A-B Enerji"},{v:"C",l:"C Enerji"},{v:"diger",l:"Diğer"}]} value={enerji} onChange={setEnerji}/>
          <div style={{background:C.blueLight,borderRadius:10,padding:"10px 12px",marginBottom:4}}>
            <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>BDDK Azami LTV: %{maxLTV} → Max {fmtTL(degerNum*(maxLTV/100))}</p>
          </div>
        </>}
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {/* Kredi Kullandırım Komisyonu */}
        <div style={{marginTop:4,marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const azami=V>0&&V<12?0.50*(V/12):0.50;
                setKullKomisyon(val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azamiKull??AZAMI_KULL_BIR,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5) — Madde 9/2"}
          </p>
          {r?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ Azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&r.ltvAsim&&(
        <div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
          <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ BDDK LTV Sınırı Aşıldı — Hesaplama Yapılamaz</p>
          <p style={{margin:"0 0 2px",fontSize:13,color:C.red}}>Gerçekleşen LTV: %{fmtN(r.gercekLTV)} — Azami: %{r.maxLTV}</p>
          <p style={{margin:0,fontSize:13,color:C.red}}>Kullandırılabilecek azami tutar: {fmtTL(r.maxFin)}</p>
        </div>
      )}
      {r&&!r.ltvAsim&&r.pmt&&<Card>
        <SecTitle>Konut Finansmanı Analizi</SecTitle>
        {ilkEv&&<div style={{background:C.greenLight,borderRadius:8,padding:"7px 10px",marginBottom:8}}>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:700}}>✅ İlk Ev — BSMV ve KKDF uygulanmamaktadır</p>
        </div>}
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit||r.pmt)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        {!ilkEv&&<><RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/></>}
        {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet||r.toplamNet+r.bsmvTL+r.kkdfTL)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        {r.ltvSonuc&&<RRow label="LTV" value={`% ${fmtN(r.ltvSonuc.gercekLTV)}`} sub accent={C.green}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Konut Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            📅 Ödeme Planı
          </button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⚡ Erken Kapama
          </button>
        </div>
        <RaporButon baslik="Konut Finansmanı Analizi" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit||r.pmt), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={r.bsmvR||0} kkdfOran={0}/>
      </Card>}
    </div>
  );
}

function TasitFinansman({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [aracDeger,setAracDeger]=useState("");
  const [showLimits,setShowLimits]=useState(false);
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI_KULL_BIR=0.50;

  const prevVadeRefT=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRefT.current){
      prevVadeRefT.current=vade;
      const V=parseInt(vade);
      if(V>0){
        const azami=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
        setKullKomisyon(fmtN(azami,4).replace(",","."));
      }
    }
  },[vade]);

  const getTasitLimits=(d)=>{
    const v=parseFloat(d)||0;
    if(v<=400000)  return{ltv:70,vadeMax:48};
    if(v<=800000)  return{ltv:50,vadeMax:36};
    if(v<=1200000) return{ltv:30,vadeMax:24};
    if(v<=2000000) return{ltv:20,vadeMax:12};
    return null; // 2M üzeri kredi verilmez
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt||!aracDeger)return null;
    const D=parseFloat(aracDeger);

    // 2M TL üzeri araç kredisi verilmez
    if(D>2000000) return{limitAsim:true,D};

    const lim=getTasitLimits(D);
    if(!lim) return{limitAsim:true,D};

    const gercekLTV=(T/D)*100;
    const maxFin=Math.round(D*(lim.ltv/100));

    // LTV aşımı
    if(T>maxFin) return{ltvAsim:true,maxLTV:lim.ltv,maxFin,gercekLTV,vadeMax:lim.vadeMax,D};
    // Vade aşımı
    if(V>lim.vadeMax) return{vadeAsim:true,vadeMax:lim.vadeMax,maxLTV:lim.ltv,D};

    // Eşit taksit - PMT formülü
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=Math.round(pmt*V*100)/100;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=Math.round(toplamKarPayi*(s.bireyselBSMV/100)*100)/100;
    const kkdfTL=Math.round(toplamKarPayi*(s.bireyselKKDF/100)*100)/100;
    const plan=hesaplaOdemePlani(T,V,ao,s.bireyselBSMV,s.bireyselKKDF);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVadeMaliyet=Math.round(aylikTaksit*V*100)/100;
    const azamiKull=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azamiKull);
    const kullAsim=kullOran>azamiKull;
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;
    const ltvSonuc={gercekLTV,maxLTV:lim.ltv,vadeMax:lim.vadeMax};
    // Efektif yıllık maliyet (bisection)
    const TasitFinansman_taksitBrut = pmt;
    const TasitFinansman_Tnet = T - kullUcret;
    let TasitFinansman_efAylik=0;
    if(TasitFinansman_Tnet>0&&V>0&&TasitFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=TasitFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>TasitFinansman_Tnet)lo=mid;else hi=mid;
      }
      TasitFinansman_efAylik=(lo+hi)/2;
    }
    const TasitFinansman_efYil=TasitFinansman_efAylik>0?Math.round((Math.pow(1+TasitFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:TasitFinansman_efYil,pmt,aylikTaksit,toplamNet,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,kullUcret,kullOranUyg,kullAsim,azamiKull,ltvSonuc,D};
  },[tutar,vade,oran,tip,aracDeger,kullKomisyon,s])();


  const D=parseFloat(aracDeger)||0;
  const lim=D>0&&D<=2000000?getTasitLimits(D):null;

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Taşıt Limit Modal */}
      {showLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>🚗 Standart Taşıt Kredisi Limitleri</span>
              <button onClick={()=>setShowLimits(false)} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 16px 28px"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead>
                  <tr>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"left"}}>Araç Değeri</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Max LTV</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Azami Vade</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {aralik:"≤ 400.000 ₺",ltv:"%70",vade:"48 ay",ok:true},
                    {aralik:"400.001 – 800.000 ₺",ltv:"%50",vade:"36 ay",ok:true},
                    {aralik:"800.001 – 1.200.000 ₺",ltv:"%30",vade:"24 ay",ok:true},
                    {aralik:"1.200.001 – 2.000.000 ₺",ltv:"%20",vade:"12 ay",ok:true},
                    {aralik:"≥ 2.000.001 ₺",ltv:"—",vade:"—",ok:false},
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?"#fff":"#F8FAFB"}}>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid #E5E9F0",fontWeight:600,color:row.ok?"#1C1C1E":C.red}}>{row.aralik}</td>
                      <td style={{padding:"10px 10px",fontSize:13,borderBottom:"1px solid #E5E9F0",fontWeight:800,color:row.ok?C.blue:C.red,textAlign:"center"}}>{row.ltv}</td>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid #E5E9F0",fontWeight:700,color:row.ok?C.green:C.red,textAlign:"center"}}>{row.vade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{background:"#FEF2F2",borderRadius:10,padding:"10px 12px",marginTop:12,border:`1px solid ${C.red}`}}>
                <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>
                  🚫 2.000.001 ₺ ve üzeri araçlar için bireysel amaçlı taşıt kredisi kullandırımı yapılmamaktadır.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF} onClose={()=>setShowPlan(false)} showKomisyon={r.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Araç Değeri (Zorunlu)" value={aracDeger} onChange={setAracDeger} suffix="₺" hint="BDDK LTV ve azami vade kontrolü için gerekli"/>
        <button onClick={()=>setShowLimits(true)} style={{width:"100%",marginBottom:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> Finansman Aralıklarını Görüntüle
        </button>
        {/* Araç değeri bilgi bandı */}
        {D>2000000&&<div style={{background:"#FEF2F2",borderRadius:10,padding:"9px 12px",marginBottom:10,border:`1px solid ${C.red}`}}>
          <p style={{margin:0,fontSize:12,color:C.red,fontWeight:700}}>⛔ 2.000.000 ₺ üzeri araçlara kredi kullandırılamaz</p>
        </div>}
        {D>0&&D<=2000000&&lim&&<div style={{background:C.blueLight,borderRadius:10,padding:"9px 12px",marginBottom:10}}>
          <p style={{margin:"0 0 2px",fontSize:12,color:C.blue,fontWeight:700}}>BDDK Azami LTV: %{lim.ltv} → Max {fmtTL(D*(lim.ltv/100))}</p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>Azami Vade: {lim.vadeMax} Ay</p>
        </div>}
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {/* Kullandırım Komisyonu */}
        <div style={{marginTop:4,marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const azami=V>0&&V<12?0.50*(V/12):0.50;
                setKullKomisyon(val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azamiKull??AZAMI_KULL_BIR,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
          {r?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ Azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>

      {/* Uyarılar */}
      {r&&r.limitAsim&&<div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Kredi Kullandırılamaz</p>
        <p style={{margin:0,fontSize:13,color:C.red}}>Araç değeri 2.000.000 ₺ üzerinde olduğundan taşıt finansmanı kullandırılamaz.</p>
      </div>}
      {r&&r.ltvAsim&&<div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ LTV Sınırı Aşıldı — Hesaplama Yapılamaz</p>
        <p style={{margin:"0 0 2px",fontSize:13,color:C.red}}>LTV: %{fmtN(r.gercekLTV)} (Azami %{r.maxLTV}) → Max Finansman: {fmtTL(r.maxFin)}</p>
      </div>}
      {r&&r.vadeAsim&&<div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Vade Aşıldı — Hesaplama Yapılamaz</p>
        <p style={{margin:0,fontSize:13,color:C.red}}>Bu araç değeri için azami vade {r.vadeMax} aydır.</p>
      </div>}

      {/* Sonuçlar */}
      {r&&r.pmt&&<Card>
        <SecTitle>Taşıt Finansmanı Analizi</SecTitle>
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        <RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
        {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet||r.toplamNet+r.bsmvTL+r.kkdfTL)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Taşıt Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            📅 Ödeme Planı
          </button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⚡ Erken Kapama
          </button>
        </div>
        <RaporButon baslik="Taşıt Finansmanı Analizi" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF}/>
      </Card>}
    </div>
  );
}


function YatirimFonuFinansman({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI_KULL_BIR=0.50;

  const prevVadeRefY=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRefY.current){
      prevVadeRefY.current=vade;
      const V=parseInt(vade);
      if(V>0){
        const azami=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
        setKullKomisyon(fmtN(azami,4).replace(",","."));
      }
    }
  },[vade]);

  const getVadeLimit=(t)=>{
    const v=parseFloat(t)||0;
    if(!v) return null;
    if(v<=125000) return 36;
    if(v<=250000) return 24;
    return 12;
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt)return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const lim=getVadeLimit(T);
    if(lim&&V>lim) return{vadeAsim:true,vadeLimit:lim,T};
    const bsmvR=s.bireyselBSMV;
    const kkdfR=s.bireyselKKDF;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(bsmvR/100);
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVadeMaliyet=Math.round(aylikTaksit*V*100)/100;
    const azamiKull=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azamiKull);
    const kullAsim=kullOran>azamiKull;
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;
    // Efektif yıllık maliyet (bisection)
    const YatirimFonuFinansman_taksitBrut = pmt;
    const YatirimFonuFinansman_Tnet = T - kullUcret;
    let YatirimFonuFinansman_efAylik=0;
    if(YatirimFonuFinansman_Tnet>0&&V>0&&YatirimFonuFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=YatirimFonuFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>YatirimFonuFinansman_Tnet)lo=mid;else hi=mid;
      }
      YatirimFonuFinansman_efAylik=(lo+hi)/2;
    }
    const YatirimFonuFinansman_efYil=YatirimFonuFinansman_efAylik>0?Math.round((Math.pow(1+YatirimFonuFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:YatirimFonuFinansman_efYil,pmt,aylikTaksit,toplamNet,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,bsmvR,kkdfR,vadeLimit:lim,kullUcret,kullOranUyg,kullAsim,azamiKull};
  },[tutar,vade,oran,tip,kullKomisyon,s])();


  const lim=getVadeLimit(tutar);

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={r.bsmvR} kkdfOran={r.kkdfR} onClose={()=>setShowPlan(false)} showKomisyon={r.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {lim&&<div style={{background:C.blueLight,borderRadius:10,padding:"9px 12px",marginBottom:4}}>
          <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>
            BDDK Azami Vade: {lim} Ay
          </p>
          <p style={{margin:"3px 0 0",fontSize:11,color:C.sub}}>
            {parseFloat(tutar)<=125000?"≤ 125.000 ₺ → max 36 Ay":parseFloat(tutar)<=250000?"125.001–250.000 ₺ → max 24 Ay":"> 250.000 ₺ → max 12 Ay"}
          </p>
        </div>}
        {/* Kullandırım Komisyonu */}
        <div style={{marginTop:8,marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const azami=V>0&&V<12?0.50*(V/12):0.50;
                setKullKomisyon(val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azamiKull??AZAMI_KULL_BIR,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
          {r?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ Azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&r.vadeAsim&&(
        <div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
          <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Azami Vade Aşıldı — Hesaplama Yapılamaz</p>
          <p style={{margin:0,fontSize:13,color:C.red}}>Bu tutar için BDDK azami vade {r.vadeLimit} aydır.</p>
        </div>
      )}
      {r&&!r.vadeAsim&&r.pmt&&<Card>
        <SecTitle>Yatırım Fonu Finansmanı</SecTitle>
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        <RRow label={`BSMV (%${r.bsmvR})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${r.kkdfR})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet||r.toplamNet+r.bsmvTL+r.kkdfTL)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Yatırım Fonu Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            📅 Ödeme Planı
          </button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⚡ Erken Kapama
          </button>
        </div>
        <RaporButon baslik="Yatırım Fonu Finansmanı" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${r.bsmvR})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${r.kkdfR})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF}/>
      </Card>}
    </div>
  );
}



function ToggFinansman({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [aracDeger,setAracDeger]=useState("");
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [showToggLimits,setShowToggLimits]=useState(false);
  const AZAMI=0.50;

  const prevVadeRef=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRef.current){
      prevVadeRef.current=vade;
      const V=parseInt(vade);
      if(V>0) setKullKomisyon(fmtN(V<12?AZAMI*(V/12):AZAMI,4).replace(",","."));
    }
  },[vade]);

  const getLimits=(d)=>{
    const D=parseFloat(d)||0;
    if(D<=0) return null;
    if(D<=2500000)  return{ltv:70,vadeMax:48};
    if(D<=5000000)  return{ltv:50,vadeMax:36};
    if(D<=6500000)  return{ltv:30,vadeMax:24};
    if(D<=7500000)  return{ltv:20,vadeMax:12};
    return{ltv:0,vadeMax:0};
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    // oran en az 1 tam sayı girilmeli (tek haneli bile kabul)
    if(!T||!V||!rt||oran===""||oran.endsWith(".")) return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const D=parseFloat(aracDeger)||0;
    const lim=getLimits(D);
    if(D>0){
      if(!lim||lim.ltv===0) return{ltvAsim:true,limitMesaj:"7.500.000 TL üzeri araçlarda Togg finansmanı uygulanmaz."};
      const maxFin=Math.round(D*(lim.ltv/100));
      if(T>maxFin) return{ltvAsim:true,maxFin,maxLTV:lim.ltv,gercekLTV:(T/D)*100};
      if(V>lim.vadeMax) return{vadeAsim:true,vadeMax:lim.vadeMax};
    }
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(s.bireyselBSMV/100);
    const kkdfTL=toplamKarPayi*(s.bireyselKKDF/100);
    const plan=hesaplaOdemePlani(T,V,ao,s.bireyselBSMV,s.bireyselKKDF);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVade=Math.round(aylikTaksit*V*100)/100;
    const azami=V<12?AZAMI*(V/12):AZAMI;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azami);
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVade+kullUcret)*100)/100;
    const ltvSonuc=D>0&&lim?{gercekLTV:(T/D)*100,maxLTV:lim.ltv}:null;
    // Efektif yıllık maliyet (bisection)
    const ToggFinansman_taksitBrut = pmt;
    const ToggFinansman_Tnet = T - kullUcret;
    let ToggFinansman_efAylik=0;
    if(ToggFinansman_Tnet>0&&V>0&&ToggFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=ToggFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>ToggFinansman_Tnet)lo=mid;else hi=mid;
      }
      ToggFinansman_efAylik=(lo+hi)/2;
    }
    const ToggFinansman_efYil=ToggFinansman_efAylik>0?Math.round((Math.pow(1+ToggFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:ToggFinansman_efYil,aylikTaksit,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,
      kullUcret,kullOranUyg,azami,ltvSonuc};
  },[tutar,vade,oran,tip,aracDeger,kullKomisyon,s])();


  const aracD=parseFloat(aracDeger)||0;
  const limInfo=getLimits(aracD);

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Togg Limit Tablosu Modal */}
      {showToggLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>🚗 Togg Finansman Aralıkları</span>
              <button onClick={()=>setShowToggLimits(false)} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 16px 28px"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead>
                  <tr>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"left"}}>Araç Değeri</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Max LTV</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Azami Vade</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {aralik:"≤ 2.500.000 ₺",ltv:"%70",vade:"48 ay",ok:true},
                    {aralik:"2.500.001 – 5.000.000 ₺",ltv:"%50",vade:"36 ay",ok:true},
                    {aralik:"5.000.001 – 6.500.000 ₺",ltv:"%30",vade:"24 ay",ok:true},
                    {aralik:"6.500.001 – 7.500.000 ₺",ltv:"%20",vade:"12 ay",ok:true},
                    {aralik:"≥ 7.500.001 ₺",ltv:"—",vade:"—",ok:false},
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?"#fff":"#F8FAFB"}}>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid #E5E9F0",fontWeight:600,color:row.ok?"#1C1C1E":C.red}}>{row.aralik}</td>
                      <td style={{padding:"10px 10px",fontSize:13,borderBottom:"1px solid #E5E9F0",fontWeight:800,color:row.ok?C.blue:C.red,textAlign:"center"}}>{row.ltv}</td>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid #E5E9F0",fontWeight:700,color:row.ok?C.green:C.red,textAlign:"center"}}>{row.vade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{background:"#FEF2F2",borderRadius:10,padding:"10px 12px",marginTop:12,border:`1px solid ${C.red}`}}>
                <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>
                  🚫 7.500.001 ₺ ve üzeri araçlar için bireysel taşıt kredisi kullandırımı yapılmamaktadır.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF} onClose={()=>setShowPlan(false)} showKomisyon={r?.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Araç Değeri (Zorunlu)" value={aracDeger} onChange={setAracDeger} suffix="₺"
          hint="Togg LTV ve azami vade kontrolü için gerekli"/>
        <button onClick={()=>setShowToggLimits(true)} style={{width:"100%",marginBottom:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> Finansman Aralıklarını Görüntüle
        </button>
        {aracD>0&&(aracD>7500000?(
          <div style={{background:"#FEF2F2",borderRadius:8,padding:"8px 12px",marginBottom:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:12,color:C.red,fontWeight:700}}>🚫 7.500.000 TL üzeri araçlarda Togg finansmanı uygulanmaz.</p>
          </div>
        ):limInfo?(
          <div style={{background:C.blueLight,borderRadius:8,padding:"8px 12px",marginBottom:4}}>
            <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>
              Azami: {fmtTL(Math.round(aracD*(limInfo.ltv/100)))} (%{limInfo.ltv} LTV) · Max {limInfo.vadeMax} ay
            </p>
          </div>
        ):null)}
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const raw=e.target.value;
                const v=parseFloat(raw);
                const V=parseInt(vade)||0;
                const az=V>0&&V<12?AZAMI*(V/12):AZAMI;
                if(!isNaN(v)&&v>az) setKullKomisyon(fmtN(az,4).replace(",","."));
                else setKullKomisyon(raw);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azami??AZAMI,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
        </div>
      </Card>

      {r?.ltvAsim&&<div style={{background:"#FEF2F2",borderRadius:14,padding:"14px 16px",marginBottom:10,border:`1.5px solid ${C.red}`}}>
        {r.limitMesaj
          ? <p style={{margin:0,fontSize:13,color:C.red,fontWeight:700}}>🚫 {r.limitMesaj}</p>
          : <><p style={{margin:"0 0 4px",fontSize:13,color:C.red,fontWeight:800}}>⛔ LTV Sınırı Aşıldı</p>
             <p style={{margin:0,fontSize:12,color:C.red}}>Azami: {fmtTL(r.maxFin)} (%{r.maxLTV} LTV) · Mevcut LTV: %{fmtN(r.gercekLTV)}</p></>}
      </div>}
      {r?.vadeAsim&&<div style={{background:"#FEF2F2",borderRadius:14,padding:"12px 16px",marginBottom:10,border:`1.5px solid ${C.orange}`}}>
        <p style={{margin:0,fontSize:13,color:C.orange,fontWeight:700}}>⛔ Azami vade {r.vadeMax} ay</p>
      </div>}

      {r&&!r.ltvAsim&&!r.vadeAsim&&<>
        <Card>
          <SecTitle>Togg Finansmanı Analizi</SecTitle>
          <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
          <RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
          <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
          {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
          <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
          {r.ltvSonuc&&<RRow label="LTV" value={`% ${fmtN(r.ltvSonuc.gercekLTV)}`} sub accent={C.green}/>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Togg Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>📅 Ödeme Planı</button>
            <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>⚡ Erken Kapama</button>
          </div>
          <RaporButon baslik="Togg Finansmanı Analizi" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
            {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
            {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
            {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
            {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
            r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
            {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
            {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF}/>
        </Card>
      </>}
    </div>
  );
}

function ArsaIsyeriFinansman({s,onGecmis}){
  const [ekspertiz,setEkspertiz]=useState("");
  const [tahsisPct,setTahsisPct]=useState("");
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI=0.50;

  const prevVadeRef=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRef.current){
      prevVadeRef.current=vade;
      const V=parseInt(vade);
      if(V>0) setKullKomisyon(fmtN(V<12?AZAMI*(V/12):AZAMI,4).replace(",","."));
    }
  },[vade]);

  // Tahsis oranı değişince finansman tutarını otomatik doldur
  useEffect(()=>{
    const E=parseFloat(ekspertiz)||0;
    const P=parseFloat(tahsisPct)||0;
    if(E>0&&P>0&&P<=100){
      const hesaplanan=Math.round(E*(P/100));
      setTutar(String(hesaplanan));
    }
  },[ekspertiz,tahsisPct]);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt||oran===""||oran.endsWith(".")) return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const bsmvR=s.bireyselBSMV;
    const kkdfR=s.bireyselKKDF;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(bsmvR/100);
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVade=Math.round(aylikTaksit*V*100)/100;
    const azami=V<12?AZAMI*(V/12):AZAMI;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azami);
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVade+kullUcret)*100)/100;
    // Efektif yıllık maliyet (bisection)
    const ArsaIsyeriFinansman_taksitBrut = pmt;
    const ArsaIsyeriFinansman_Tnet = T - kullUcret;
    let ArsaIsyeriFinansman_efAylik=0;
    if(ArsaIsyeriFinansman_Tnet>0&&V>0&&ArsaIsyeriFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=ArsaIsyeriFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>ArsaIsyeriFinansman_Tnet)lo=mid;else hi=mid;
      }
      ArsaIsyeriFinansman_efAylik=(lo+hi)/2;
    }
    const ArsaIsyeriFinansman_efYil=ArsaIsyeriFinansman_efAylik>0?Math.round((Math.pow(1+ArsaIsyeriFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:ArsaIsyeriFinansman_efYil,aylikTaksit,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,
      kullUcret,kullOranUyg,azami,bsmvR,kkdfR,T,V};
  },[tutar,vade,oran,tip,kullKomisyon,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={r?.bsmvR||0} kkdfOran={r?.kkdfR||0} onClose={()=>setShowPlan(false)} showKomisyon={r?.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>

        {/* Ekspertiz Değeri */}
        <Field label="Arsa/İşyeri Ekspertiz Değeri (Zorunlu)" value={ekspertiz} onChange={setEkspertiz} suffix="₺"
          hint="Finansman tutarı bu değer üzerinden hesaplanır"/>

        {/* Tahsis Kararı Finansman Yüzdesi */}
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>
            Tahsis Kararı Finansman Yüzdesi
          </label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={tahsisPct}
              onChange={e=>{
                const v=parseFloat(e.target.value);
                if(isNaN(v)||v>100) return;
                setTahsisPct(e.target.value);
              }}
              placeholder="0"
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>Max %100 · Ekspertiz değeri girildikten sonra finansman tutarı otomatik hesaplanır</p>
        </div>

        {/* Finansman Tutarı - readonly, otomatik */}
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Finansman Tutarı</label>
          <div style={{padding:"11px 40px 11px 13px",background:tutar?"#F9F9FB":"#F0F0F2",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"monospace",color:tutar?"#1C1C1E":C.sub,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{tutar?new Intl.NumberFormat("tr-TR").format(parseFloat(tutar)):"Ekspertiz ve % girilince hesaplanır"}</span>
            {tutar&&<span style={{fontSize:13,fontWeight:700,color:C.blue}}>₺</span>}
          </div>
        </div>

        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>

        {/* Kullandırım Komisyonu */}
        <div style={{marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const raw=e.target.value;
                const v=parseFloat(raw);
                const V=parseInt(vade)||0;
                const az=V>0&&V<12?AZAMI*(V/12):AZAMI;
                if(!isNaN(v)&&v>az) setKullKomisyon(fmtN(az,4).replace(",","."));
                else setKullKomisyon(raw);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azami??AZAMI,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
        </div>
      </Card>

      {r&&<Card>
        <SecTitle>Arsa/İşyeri Finansmanı Analizi</SecTitle>
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        <RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
        {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Arsa/İşyeri Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>📅 Ödeme Planı</button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>⚡ Erken Kapama</button>
        </div>
        <RaporButon baslik="Arsa/İşyeri Finansmanı" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Ekspertiz Değeri", value:fmtTL(parseFloat(ekspertiz))},
          {label:"Finansman Yüzdesi", value:`%${tahsisPct}`},
          {label:"Finansman Tutarı", value:fmtTL(r.T), big:true},
          {label:"Vade", value:`${r.V} ay`},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={r.bsmvR||0} kkdfOran={r.kkdfR||0}/>
      </Card>}
    </div>
  );
}

function TaksitenKredi({s}){
  const [taksit,  setTaksit]  = useState("");
  const [vade,    setVade]    = useState("");
  const [oran,    setOran]    = useState("");
  const [tip,     setTip]     = useState("aylik");
  const [tur,     setTur]     = useState("bireysel"); // bireysel | tuzel
  const [showPlan,setShowPlan]= useState(false);

  // Vergi oranları kredi türüne göre
  const bsmvOran = tur==="bireysel" ? s.bireyselBSMV : s.ticariBSMV;
  const kkdfOran = tur==="bireysel" ? s.bireyselKKDF : s.ticariKKDF;

  const r = useCallback(()=>{
    const tk = parseFloat(taksit), V = parseInt(vade), rt = parseFloat(oran);
    if(!tk||!V||!rt) return null;

    const ao = tip==="yillik" ? rt/12/100 : rt/100;

    // Taksit içinde BSMV ve KKDF var
    // Brüt taksit = anapara payı + kâr payı + BSMV + KKDF
    // BSMV ve KKDF sadece kâr payı üzerinden alınır
    // Net taksit (sadece anapara + kâr) = brüt taksit / (1 + bsmvOran/100 + kkdfOran/100)
    const vergiCarpan = 1 + bsmvOran/100 + kkdfOran/100;
    const netTaksit = tk / vergiCarpan;

    // Net taksit üzerinden anapara hesapla (ters PMT)
    const anapara = ao===0 ? netTaksit*V : netTaksit*(1-Math.pow(1+ao,-V))/ao;

    const toplamNetOdeme = netTaksit * V;
    const toplamKarPayi  = toplamNetOdeme - anapara;
    const toplamBsmv     = toplamKarPayi * bsmvOran/100;
    const toplamKkdf     = toplamKarPayi * kkdfOran/100;
    const toplamBrutOdeme= tk * V;

    // Ödeme planı
    const plan = hesaplaOdemePlani(anapara, V, ao, bsmvOran, kkdfOran);

    return{
      anapara, netTaksit, toplamNetOdeme,
      toplamKarPayi, toplamBsmv, toplamKkdf,
      toplamBrutOdeme, vergiCarpan,
      girilenTaksit: tk, plan,
    };
  },[taksit,vade,oran,tip,tur,s])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={bsmvOran} kkdfOran={kkdfOran} onClose={()=>setShowPlan(false)}/>}
      <Card>
        <SecTitle>Kredi Türü</SecTitle>
        <Seg options={[{v:"bireysel",l:"Bireysel"},{v:"tuzel",l:"Tüzel/Ticari"}]} value={tur} onChange={setTur}/>
        <div style={{background:C.blueLight,borderRadius:8,padding:"8px 10px",marginBottom:4}}>
          <p style={{margin:0,fontSize:11,color:C.blue}}>
            BSMV: %{fmtN(bsmvOran,0)} — KKDF: %{fmtN(kkdfOran,0)} — Vergi çarpanı: {fmtN(1+bsmvOran/100+kkdfOran/100,4)}x
          </p>
        </div>
      </Card>
      <Card>
        <SecTitle>Parametreler</SecTitle>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Aylık Brüt Taksit Tutarı" value={taksit} onChange={setTaksit} suffix="₺" hint="BSMV ve KKDF dahil ödenen tutar"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
      </Card>

      {r&&<>
        <Card>
          <SecTitle>Finansman Tutarı</SecTitle>
          <RRow label="Kullanılabilir Kredi (Anapara)" value={fmtTL(r.anapara)} accent={C.blue} big/>
          <div style={{height:1,background:C.border,margin:"6px 0"}}/>
          <RRow label="Net Taksit (Vergi Hariç)" value={fmtTL(r.netTaksit)} sub/>
          <RRow label={`BSMV (%${fmtN(bsmvOran,0)}) payı / taksit`} value={fmtTL(r.girilenTaksit - r.netTaksit - r.toplamKarPayi*kkdfOran/100/parseInt(vade||"1"))} sub accent={C.red}/>
          <RRow label={`KKDF (%${fmtN(kkdfOran,0)}) payı / taksit`} value={fmtTL(r.toplamKarPayi*kkdfOran/100/parseInt(vade||"1"))} sub accent={C.red}/>
          <RRow label="Girilen Brüt Taksit" value={fmtTL(r.girilenTaksit)} accent={C.orange}/>
          <div style={{height:1,background:C.border,margin:"6px 0"}}/>
          <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
          <RRow label={`Toplam BSMV (%${fmtN(bsmvOran,0)})`} value={fmtTL(r.toplamBsmv)} sub accent={C.red}/>
          <RRow label={`Toplam KKDF (%${fmtN(kkdfOran,0)})`} value={fmtTL(r.toplamKkdf)} sub accent={C.red}/>
          <RRow label="Toplam Brüt Ödeme" value={fmtTL(r.toplamBrutOdeme)} accent={C.green} big/>

          <button onClick={()=>setShowPlan(true)} style={{
            width:"100%",marginTop:12,padding:"12px",borderRadius:12,
            border:`1.5px solid ${C.blue}`,background:C.blueLight,
            color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"
          }}>
            📅 Ödeme Planını Görüntüle
          </button>
        </Card>

        <RaporButon baslik="Taksitten Tutar Hesaplama" plan={r.plan} satirlar={[
          {label:"Kredi Türü", value:tur==="bireysel"?"Bireysel":"Tüzel/Ticari"},
          {label:"Kullanılabilir Kredi", value:fmtTL(r.anapara), big:true},
          {label:"Girilen Brüt Taksit", value:fmtTL(r.girilenTaksit)},
          {label:`BSMV (%${fmtN(bsmvOran,0)})`, value:fmtTL(r.toplamBsmv)},
          {label:`KKDF (%${fmtN(kkdfOran,0)})`, value:fmtTL(r.toplamKkdf)},
          {label:"Toplam Brüt Ödeme", value:fmtTL(r.toplamBrutOdeme), big:true},
        ]}/>
      </>}
    </div>
  );
}

function SpotKredi({s,onGecmis}){
  const [doviz,setDoviz]=useState("TL");
  const [tutar,setTutar]=useState("");
  const [gun,setGun]=useState("");       // ham giriş (gün sayısı veya tarih)
  const [vadeTip,setVadeTip]=useState("gun"); // "gun" | "tarih"
  const [oran,setOran]=useState("");
  const [kullanımOrani,setKullanımOrani]=useState("1.10");
  const [showPlan,setShowPlan]=useState(false);

  const SABIT_KULLANIRIM = 1.10; // YP'de tavan yok, sabit gelir

  const dovizSembol = doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const fmtDoviz=(n)=>n==null?"—":`${dovizSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  // Döviz değişince komisyon 1.10'a sıfırla
  useEffect(()=>{ setKullanımOrani("1.10"); },[doviz]);

  // TL: vade DEĞİŞİNCE azami komisyonu doldur (sadece gun değişimi)
  const prevGunRef = useRef("");
  useEffect(()=>{
    if(gun !== prevGunRef.current){
      prevGunRef.current = gun;
      if(doviz==="TL"){
        const G=gunHesapla(gun);
        if(G>0){
          const azami = G<365 ? SABIT_KULLANIRIM*(G/365) : SABIT_KULLANIRIM;
          setKullanımOrani(fmtN(azami,4).replace(",","."));
        }
      }
    }
  },[gun]);

  const gunHesapla=(val)=>{
    if(!val) return 0;
    const s=String(val).trim();
    // GG.AA.YYYY formatı
    if(/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)){
      const [g,a,y]=s.split(".");
      const dt=new Date(parseInt(y),parseInt(a)-1,parseInt(g));
      if(!isNaN(dt.getTime())){
        const today=new Date(); today.setHours(0,0,0,0);
        const diff=Math.round((dt-today)/(1000*60*60*24));
        return diff>0?diff:0;
      }
    }
    // Gün sayısı (sadece rakam)
    if(/^\d+$/.test(s)){
      const n=parseInt(s);
      return isNaN(n)?0:n;
    }
    return 0;
  };

  // Tarih input handler: otomatik nokta ekle GG.AA.YYYY
  const handleTarihInput=(v)=>{
    // Tüm non-digit karakterleri sil
    const digits=String(v).replace(/\D/g,"").slice(0,8);
    let raw=digits;
    if(digits.length>4) raw=digits.slice(0,2)+"."+digits.slice(2,4)+"."+digits.slice(4);
    else if(digits.length>2) raw=digits.slice(0,2)+"."+digits.slice(2);
    setGun(raw);
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),G=gunHesapla(gun),rt=parseFloat(oran)/100;
    if(!T||!G||!rt)return null;
    const gunlukOran=rt/365;
    const karPayi=Math.round(T*gunlukOran*G*100)/100;

    // YP'de BSMV/KKDF yok
    const bsmvTL=doviz==="TL"?Math.round(karPayi*(s.ticariBSMV/100)*100)/100:0;
    const kkdfTL=doviz==="TL"?Math.round(karPayi*(s.ticariKKDF/100)*100)/100:0;
    const efektif=gunlukOran*365*100;

    // Komisyon: TL'de oransal tavan, YP'de serbest
    const kullOran = parseFloat(kullanımOrani.replace(",","."))||0;
    let kullAsim=false, kullOranUygulanan=kullOran, azamiKull=null;
    if(doviz==="TL"){
      azamiKull = G<365 ? SABIT_KULLANIRIM*(G/365) : SABIT_KULLANIRIM;
      kullOranUygulanan = Math.min(kullOran, azamiKull);
      kullAsim = kullOran > azamiKull;
    }
    const kullUcret = kullOran>0 ? Math.round(T*(kullOranUygulanan/100)*100)/100 : 0;

    const toplamVadeMaliyet=Math.round((karPayi+bsmvTL+kkdfTL)*100)/100;
    const toplamMaliyet=Math.round((karPayi+bsmvTL+kkdfTL+kullUcret)*100)/100;
    const plan=[{
      ay:1, karPayi, anapara:T,
      vergi:bsmvTL+kkdfTL,
      komisyon:kullUcret,
      toplam:T+toplamVadeMaliyet,
      bakiye:0
    }];
    // Efektif oran komisyon dahil: toplamMaliyet / (T - kullUcret) * (360/G) * 100
    const T_net_spot = T - kullUcret;
    const efektifKomDahil = T_net_spot > 0 && G > 0
      ? Math.round((toplamMaliyet / T_net_spot) * (365/G) * 10000) / 100
      : efektif;
    return{karPayi,bsmvTL,kkdfTL,efektif,efektifKomDahil,gunlukFaiz:T*gunlukOran,T,G,
      kullUcret,kullOranUygulanan,kullAsim,azamiKull,
      toplamMaliyet,plan,doviz};
  },[tutar,gun,oran,kullanımOrani,doviz,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani
        plan={r.plan}
        bsmvOran={doviz==="TL"?s.ticariBSMV:0}
        kkdfOran={doviz==="TL"?s.ticariKKDF:0}
        onClose={()=>setShowPlan(false)}
        showKomisyon={r.kullUcret>0}
        basitOran={r.efektif}
        efektifOran={r.efektifKomDahil}
       anaparaTutar={parseFloat(tutar)}/>}
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        {/* Vade — Gün veya Tarih */}
        <div>
          <div style={{display:"flex",gap:6,marginBottom:4}}>
            <button onClick={()=>{setVadeTip("gun");setGun("");}} style={{flex:1,padding:"6px",borderRadius:8,border:`1.5px solid ${vadeTip==="gun"?C.blue:C.border}`,background:vadeTip==="gun"?C.blueLight:"#fff",color:vadeTip==="gun"?C.blue:C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>📅 Gün Sayısı</button>
            <button onClick={()=>{setVadeTip("tarih");setGun("");}} style={{flex:1,padding:"6px",borderRadius:8,border:`1.5px solid ${vadeTip==="tarih"?C.blue:C.border}`,background:vadeTip==="tarih"?C.blueLight:"#fff",color:vadeTip==="tarih"?C.blue:C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>🗓 Vade Tarihi</button>
          </div>
          {vadeTip==="gun"
            ? <Field label="Vade Gün Sayısı" value={gun} onChange={setGun} suffix="Gün" hint={gunHesapla(gun)>0?`${gunHesapla(gun)} gün`:""}/>
            : <div>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:C.blue}}>Vade Tarihi (GG.AA.YYYY)</p>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={gun}
                  onChange={e=>handleTarihInput(e.target.value)}
                  placeholder="21.07.2027"
                  style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",fontSize:17,fontWeight:600,borderRadius:12,border:`1.5px solid ${C.border}`,background:"#fff",outline:"none",letterSpacing:2}}
                />
                <p style={{margin:"4px 0 0",fontSize:12,color:gunHesapla(gun)>0?C.green:gun.replace(/\./g,"").length>=8?C.red:C.sub}}>
                  {gunHesapla(gun)>0?`✓ ${gunHesapla(gun)} gün kaldı`:gun.replace(/\./g,"").length>=8?"⚠️ Geçersiz tarih":"Sadece rakam yazın — nokta otomatik eklenir"}
                </p>
              </div>
            }
        </div>
        <Field label="Yıllık Kâr Payı Oranı" value={oran} onChange={setOran} suffix="%"/>
        {/* Kullandırım Oranı */}
        <div style={{marginBottom:4}}>
          <div style={{marginBottom:4}}>
            <label style={{fontSize:12,fontWeight:600,color:C.sub}}>Kredi Kullandırım Komisyonu</label>
          </div>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullanımOrani}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const G=parseInt(gun)||0;
                const azami=G>0&&G<365?SABIT_KULLANIRIM*(G/365):SABIT_KULLANIRIM;
                setKullanımOrani(doviz==="TL"&&val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>

          {r?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&<Card>
        <SecTitle>Spot Finansman Analizi {doviz!=="TL"&&`(${doviz})`}</SecTitle>
        <RRow label={`Toplam Kâr Payı (${gunHesapla(gun)} Gün)`} value={fmtDoviz(r.karPayi)} accent={C.orange} big/>
        {doviz==="TL"&&<>
          <RRow label={`BSMV (%${s.ticariBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
          <RRow label={`KKDF (%${s.ticariKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
          <RRow label="Toplam Kâr Payı Maliyeti" value={fmtTL(r.karPayi+r.bsmvTL+r.kkdfTL)} accent={C.blue} big/>
        </>}
        {r.kullUcret>0&&(
          <RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUygulanan,4)} — peşin)`} value={fmtDoviz(r.kullUcret)} accent={C.purple} sub/>
        )}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtDoviz(r.toplamMaliyet)} accent={C.green} big/>
        <RRow label="Basit Yıllık %" value={`% ${fmtN(r.efektif,2)}`} sub/>
        <RRow label="Efektif Yıllık % (Komisyon Dahil)" value={`% ${fmtN(r.efektifKomDahil,2)}`} sub accent={C.orange}/>
        <div style={{marginTop:8,padding:"12px 14px",background:"#F0F5FF",borderRadius:12,border:`1.5px solid ${C.blue}`}}>
          <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.04em"}}>TOPLAM GERİ ÖDEME</p>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <p style={{margin:0,fontSize:12,color:C.sub}}>Anapara + Toplam Maliyet</p>
            <p style={{margin:0,fontSize:22,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{fmtDoviz(parseFloat(tutar)+r.toplamMaliyet)}</p>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <p style={{margin:0,fontSize:10,color:C.sub}}>Anapara: {fmtDoviz(parseFloat(tutar))}</p>
            <p style={{margin:0,fontSize:10,color:C.sub}}>Maliyet: {fmtDoviz(r.toplamMaliyet)}</p>
          </div>
        </div>
        <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Spot Finansman",tutar:fmtTL(parseFloat(tutar)),vade:gunHesapla(gun)+" Gün",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:"-",plan:r?.plan})}} style={{width:"100%",marginTop:12,padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"}}>
          📅 Ödeme Planını Görüntüle
        </button>
        <RaporButon baslik={`Spot Finansman Analizi (${doviz})`} plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:`Finansman Tutarı (${doviz})`, value:fmtDoviz(r.T), big:true},
          {label:"Vade", value:`${r.G} gün`},
          {label:"Günlük Kâr Payı", value:fmtDoviz(r.gunlukFaiz)},
          {label:"Toplam Kâr Payı", value:fmtDoviz(r.karPayi)},
          doviz==="TL"?{label:`BSMV (%${s.ticariBSMV})`, value:fmtTL(r.bsmvTL)}:null,
          doviz==="TL"?{label:`KKDF (%${s.ticariKKDF})`, value:fmtTL(r.kkdfTL)}:null,
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUygulanan,4)} — peşin)`, value:fmtDoviz(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtDoviz(r.toplamMaliyet), big:true},
          {label:"Efektif Yıllık", value:`% ${fmtN(r.efektif)}`},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifKomDahil,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.ticariBSMV} kkdfOran={s.ticariKKDF}/>
      </Card>}
    </div>
  );
}


function LTV(){
  const [deger,setDeger]=useState("");const [tip,setTip]=useState("konut");
  const ORANLAR={konut:0.90,tasit:0.70,ticari:0.80};
  const r=useCallback(()=>{
    const D=parseFloat(deger);
    if(!D)return null;
    const oran=ORANLAR[tip];
    return{maxKredi:D*oran,oran:oran*100,minPesinat:D*(1-oran)};
  },[deger,tip])();
  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"konut",l:"Konut"},{v:"tasit",l:"Taşıt"},{v:"ticari",l:"Ticari"}]} value={tip} onChange={setTip}/>
        <Field label="Teminat/Gayrimenkul Değeri" value={deger} onChange={setDeger} suffix="₺"/>
        <div style={{background:C.blueLight,borderRadius:10,padding:"10px 12px",marginTop:4}}>
          <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:600}}>BDDK LTV Oranı: % {ORANLAR[tip]*100}</p>
        </div>
      </Card>
      {r&&<Card>
        <SecTitle>Kullanılabilir Kredi (LTV)</SecTitle>
        <RRow label="Azami Finansman Tutarı" value={fmtTL(r.maxKredi)} accent={C.blue} big/>
        <RRow label="LTV Oranı" value={`% ${fmtN(r.oran,0)}`}/>
        <RRow label="Min. Peşinat" value={fmtTL(r.minPesinat)} accent={C.orange}/>
      </Card>}
    </div>
  );
}

function Leasing({s,onGecmis}){
  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const SABIT_KULLANIRIM=1.10;

  const [doviz,   setDoviz]   = useState("TL");
  const [tutar,   setTutar]   = useState("");
  const [tutarDisplay, setTutarDisplay] = useState("");
  const [oran,    setOran]    = useState("");
  const [oranTip, setOranTip] = useState("ay");
  const [vade,    setVade]    = useState("");
  const [vadeTip, setVadeTip] = useState("ay");
  const [kdv,     setKdv]     = useState("");
  const [kullKomisyon, setKullKomisyon] = useState("1.10");

  const dovizSembol = doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const fmtDoviz=(n)=>n==null?"—":`${dovizSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  // Döviz değişince komisyon ve tutar sıfırla
  useEffect(()=>{
    setKullKomisyon("1.10");
    setTutar(""); setTutarDisplay("");
  },[doviz]);

  // TL: vade değişince azami komisyonu doldur
  const prevVadeRef=useRef("");
  useEffect(()=>{
    const vadeStr=`${vade}-${vadeTip}`;
    if(vadeStr!==prevVadeRef.current){
      prevVadeRef.current=vadeStr;
      if(doviz==="TL"){
        const V_raw=parseFloat(vade);
        if(V_raw>0){
          const ayV=vadeTip==="yil"?V_raw*12:V_raw;
          const gunEquiv=ayV*30;
          const azami=gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM;
          setKullKomisyon(fmtN(azami,4).replace(",","."));
        }
      }
    }
  },[vade,vadeTip]);

  const r = useCallback(()=>{
    const T  = parseFloat(tutar);
    const rt_raw = parseFloat(oran);
    const V_raw  = parseFloat(vade);
    const kdvR   = parseFloat(kdv)||0;
    if(!T||!rt_raw||!V_raw) return null;

    const aoNet = oranTip==="yil" ? rt_raw/100/12 : rt_raw/100;
    const V = vadeTip==="yil" ? Math.round(V_raw*12) : Math.round(V_raw);
    if(V<=0) return null;
    if(V<12) return{vadeAsim:true};

    const pmt_net = aoNet===0 ? T/V : T*aoNet/(1-Math.pow(1+aoNet,-V));

    const now = new Date();
    const plan = [];
    let bakiye = T;
    for(let i=1;i<=V;i++){
      const karPayi = Math.round(bakiye*aoNet*100)/100;
      const anapara = Math.round((pmt_net - karPayi)*100)/100;
      bakiye = Math.max(0, Math.round((bakiye-anapara)*100)/100);
      const tarihAy = (now.getMonth()+i)%12;
      const tarihYil = now.getFullYear()+Math.floor((now.getMonth()+i)/12);
      // KDV = (anapara + kâr payı) × kdvR%
      const kdvTutar = Math.round((anapara + karPayi)*(kdvR/100)*100)/100;
      plan.push({
        ay:i, tarih: MONTHS[tarihAy]+" "+tarihYil,
        taksit: Math.round((pmt_net + kdvTutar)*100)/100,
        anapara, karPayi,
        kdvTutar,
        bakiye
      });
    }

    const toplamKarPayi   = plan.reduce((a,p)=>a+p.karPayi, 0);
    const toplamKdv       = plan.reduce((a,p)=>a+p.kdvTutar, 0);
    const toplamGeriOdeme = plan.reduce((a,p)=>a+p.taksit, 0);
    const yillikMaliyet   = toplamKarPayi + toplamKdv;

    // Komisyon
    const kullOranGiris=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azamiKull=doviz==="TL"?(gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM):null;
    const kullOranUyg=doviz==="TL"?Math.min(kullOranGiris,azamiKull):kullOranGiris;
    const kullAsim=doviz==="TL"&&kullOranGiris>azamiKull;
    const kullUcret=kullOranGiris>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0) plan[0]={...plan[0],komisyon:kullUcret};

    const toplamMaliyet=Math.round((toplamGeriOdeme+kullUcret)*100)/100;

    // Efektif yıllık (bisection) - müşteri ödemesi KDV dahil taksit
    const T_netL = T - kullUcret;
    const taksitL = plan[0]?.taksit || pmt_net;
    let efL = 0;
    if(T_netL>0 && V>0 && taksitL>0){
      let lo=0.0001/12, hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=taksitL*(1-Math.pow(1+mid,-V))/mid;
        if(pv>T_netL) lo=mid; else hi=mid;
      }
      efL=(lo+hi)/2;
    }
    const efektifYillik = efL>0 ? Math.round((Math.pow(1+efL,12)-1)*10000)/100 : 0;

    return {
      T, V, rt_raw, oranTip, vadeTip, kdvR,
      pmt_net, pmt_kdv: plan[0]?.taksit||pmt_net,
      toplamKarPayi, toplamKdv, toplamVergi: toplamKdv,
      yillikMaliyet, toplamGeriOdeme, toplamMaliyet,
      kullUcret, kullOranUyg, kullAsim, azamiKull, plan, efektifYillik
    };
  },[tutar,oran,vade,kdv,oranTip,vadeTip,kullKomisyon,doviz])();

  useEffect(()=>{
    if(r?.plan&&r.plan.length>0&&onGecmis){
      onGecmis({modul:"Finansal Kiralama",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.pmt_kdv)});
    }
  // eslint-disable-next-line
  },[!!r?.plan]);



  // ─── SONUÇ + ÖDEME PLANI ─────────────────────────────────────────────────
  const thS = {padding:"10px 12px",fontWeight:700,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"left",borderBottom:`2px solid ${C.blue}`,background:C.card};
  const tdS = (color,align="right")=>({padding:"11px 12px",fontSize:13,fontFamily:"monospace",fontWeight:600,color:color||C.label,textAlign:align,borderBottom:`1px solid ${C.border}`});

  return(
    <div style={{padding:"0 16px 40px"}}>
      {/* Form Kartı */}
      <Card>
        {/* Para Birimi */}
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        {/* Finansman Tutarı */}
        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Finansman Tutarı</p>
        <div style={{position:"relative",marginBottom:16}}>
          <input inputMode="decimal" value={tutarDisplay}
            onChange={e=>{
              const raw=e.target.value.replace(/\./g,"").replace(/[^0-9,]/g,"");
              const parts=raw.split(",");
              parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,".");
              setTutarDisplay(parts.join(","));
              setTutar(raw.replace(/\./g,"").replace(",","."));
            }}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 44px 11px 14px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
          <span style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14}}>{dovizSembol}</span>
        </div>

        {/* Kâr Oranı */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <p style={{margin:0,fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Kâr Oranı</p>
          <div style={{display:"flex",background:"#E5E5EA",borderRadius:8,padding:2}}>
            {["ay","yil"].map(t=>(
              <button key={t} onClick={()=>setOranTip(t)} style={{padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:oranTip===t?C.blue:"transparent",color:oranTip===t?"#fff":C.sub,transition:"all 0.15s"}}>
                {t==="ay"?"Ay":"Yıl"}
              </button>
            ))}
          </div>
        </div>
        <div style={{position:"relative",marginBottom:16}}>
          <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14}}>%</span>
          <input inputMode="decimal" value={oran} onChange={e=>setOran(e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,""))}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 14px 11px 32px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
        </div>

        {/* Vade */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <p style={{margin:0,fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Vade</p>
          <div style={{display:"flex",background:"#E5E5EA",borderRadius:8,padding:2}}>
            {["ay","yil"].map(t=>(
              <button key={t} onClick={()=>setVadeTip(t)} style={{padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:vadeTip===t?C.blue:"transparent",color:vadeTip===t?"#fff":C.sub,transition:"all 0.15s"}}>
                {t==="ay"?"Ay":"Yıl"}
              </button>
            ))}
          </div>
        </div>
        <div style={{position:"relative",marginBottom:16}}>
          <input inputMode="decimal" value={vade} onChange={e=>setVade(e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,""))}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 48px 11px 14px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
          <span style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{vadeTip==="ay"?"Ay":"Yıl"}</span>
        </div>

        {/* KDV */}
        <p style={{margin:"0 0 5px",fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>KDV Oranı</p>
        <div style={{position:"relative",width:"48%",marginBottom:16}}>
          <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14}}>%</span>
          <input inputMode="decimal" value={kdv} onChange={e=>setKdv(e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,""))}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 14px 11px 32px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
        </div>
        {/* Kullandırım Komisyonu */}
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:5}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{
              const val=parseFloat(e.target.value)||0;
              const V=parseFloat(vade)||0;
              const ayV=vadeTip==="yil"?V*12:V;
              const gunEquiv=ayV*30;
              const azami=gunEquiv>0&&gunEquiv<365?1.10*(gunEquiv/365):1.10;
              setKullKomisyon(doviz==="TL"&&val>azami?fmtN(azami,4).replace(",","."):e.target.value);
            }}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>
          {doviz==="TL"
            ? (vade?`TL azami: %${fmtN(r?.azamiKull??SABIT_KULLANIRIM,4)}${(vadeTip==="ay"?parseFloat(vade):parseFloat(vade)*12)<12?" (oransal)":""} — aşağı revize edilebilir`:"TL — Madde 9/2, oransal tavan")
            : "YP — Tavan yok, serbestçe belirlenebilir (Madde 9/2)"}
        </p>
        {r?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
          <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami %{fmtN(r.azamiKull,4)} uygulandı</p>
        </div>}
      </Card>

      {/* Min vade uyarısı */}
      {r?.vadeAsim&&<div style={{margin:"0 0 12px",background:"#FEF2F2",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 2px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Minimum Vade: 12 Ay</p>
        <p style={{margin:0,fontSize:12,color:C.red}}>Finansal Kiralama'da asgari vade 12 ay (1 yıl)'dır.</p>
      </div>}
      {/* Sonuç - sadece değerler girilince göster */}
      {r&&!r.vadeAsim&&<>
      {/* Özet Kart */}
      <div style={{margin:"0 16px 16px",background:C.card,borderRadius:16,padding:"20px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
        <p style={{margin:"0 0 16px",fontSize:18,fontWeight:800,color:C.label}}>Finansal Kiralama {doviz!=="TL"&&`(${doviz})`}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
          {[
            {l:"FİNANSMAN TÜRÜ",   v:"Finansal Kiralama"},
            {l:"ANAPARA",          v:fmtDoviz(r.T)},
            {l:"VADE",             v:`${r.V} Ay`},
            {l:"ORAN",             v:`%${fmtN(r.rt_raw,2)} ${r.oranTip==="ay"?"Aylık":"Yıllık"}`},
            {l:"KDV",              v:`%${fmtN(r.kdvR,0)}`},
            {l:"AYLIK TAKSİT",     v:fmtDoviz(r.pmt_kdv)},
            {l:"TOPLAM KÂR PAYI",  v:fmtDoviz(r.toplamKarPayi), red:true},
            {l:"TOPLAM KDV",       v:fmtDoviz(r.toplamKdv), red:true},
            {l:"TOPLAM VERGİ",     v:fmtDoviz(r.toplamVergi), red:true},
            {l:"YILLIK MALİYET",   v:fmtDoviz(r.yillikMaliyet), red:true},
            ...(r.kullUcret>0?[{l:"KREDİ KULLANDIRM KOM.",v:fmtDoviz(r.kullUcret),purple:true}]:[]),
          ].map((item,i)=>(
            <div key={i}>
              <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>{item.l}</p>
              <p style={{margin:0,fontSize:15,fontWeight:800,color:item.purple?C.purple:item.red?C.red:C.label}}>{item.v}</p>
            </div>
          ))}
        </div>
        {/* Toplam Geri Ödeme - tam genişlik */}
        <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>TOPLAM MÜŞTERİ MALİYETİ</p>
          <p style={{margin:0,fontSize:26,fontWeight:900,color:C.green,fontFamily:"monospace"}}>{fmtDoviz(r.toplamMaliyet)}</p>
        </div>
        <div style={{padding:"0 2px",marginTop:8}}>
          <RaporButon baslik={`Finansal Kiralama (${doviz})`} plan={r.plan} satirlar={[
            {label:"Finansman Türü", value:"Finansal Kiralama"},
            {label:`Anapara (${doviz})`, value:fmtDoviz(r.T)},
            {label:"Vade", value:`${r.V} Ay`},
            {label:"Oran", value:`%${fmtN(r.rt_raw,2)} ${r.oranTip==="ay"?"Aylık":"Yıllık"}`},
            {label:"KDV", value:`%${fmtN(r.kdvR,0)}`},
            {label:"Aylık Taksit", value:fmtDoviz(r.pmt_kdv), big:true},
            {label:"Toplam Kâr Payı", value:fmtDoviz(r.toplamKarPayi)},
            {label:"Toplam KDV", value:fmtDoviz(r.toplamKdv)},
            r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtDoviz(r.kullUcret)}:null,
            {label:"Toplam Müşteri Maliyeti", value:fmtDoviz(r.toplamMaliyet), big:true},
                                  {label:"Basit Yıllık Oran", value:`% ${fmtN(r?.oranTip==="ay"?(r?.rt_raw||0)*12:(r?.rt_raw||0),2)}`},
                                  {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
                                  ].filter(Boolean)} showKdv={true}/>
        </div>
      </div>

      {/* Ödeme Planı */}
      <div style={{margin:"0 16px",background:C.card,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
        <p style={{margin:0,padding:"16px 18px 12px",fontSize:16,fontWeight:800,color:C.label}}>Ödeme Planı</p>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:620}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"center",width:36}}>AY</th>
                <th style={thS}>TARİH</th>
                <th style={{...thS,textAlign:"right"}}>TAKSİT</th>
                <th style={{...thS,textAlign:"right"}}>ANAPARA</th>
                <th style={{...thS,textAlign:"right",color:C.red}}>KÂR PAYI</th>
                <th style={{...thS,textAlign:"right",color:C.orange}}>KDV</th>
                <th style={{...thS,textAlign:"right"}}>KALAN ANAPARA</th>
              </tr>
            </thead>
            <tbody>
              {r.plan.map((row,i)=>(
                <tr key={i} style={{background:i%2===0?"#fff":"#F8FAFB"}}>
                  <td style={{...tdS(C.blue,"center"),fontWeight:700}}>{row.ay}</td>
                  <td style={{...tdS(C.label,"left"),fontFamily:"inherit",fontSize:12}}>{row.tarih}</td>
                  <td style={tdS()}>{fmtDoviz(row.taksit)}</td>
                  <td style={tdS(C.sub)}>{fmtDoviz(row.anapara)}</td>
                  <td style={tdS(C.red)}>{fmtDoviz(row.karPayi)}</td>
                  <td style={tdS(C.orange)}>{fmtDoviz(row.kdvTutar)}</td>
                  <td style={tdS(C.sub)}>{fmtDoviz(row.bakiye)}</td>
                </tr>
              ))}
              <tr style={{background:"#EBF3FB",borderTop:`2px solid ${C.blue}`}}>
                <td colSpan={2} style={{...tdS(C.blue,"left"),fontWeight:800,padding:"12px 12px"}}>TOPLAM</td>
                <td style={{...tdS(),fontWeight:800}}>{fmtDoviz(r.toplamGeriOdeme)}</td>
                <td style={{...tdS(C.sub),fontWeight:800}}>{fmtDoviz(r.T)}</td>
                <td style={{...tdS(C.red),fontWeight:800}}>{fmtDoviz(r.toplamKarPayi)}</td>
                <td style={{...tdS(C.orange),fontWeight:800}}>{fmtDoviz(r.toplamKdv)}</td>
                <td style={{...tdS(C.sub),fontWeight:800}}>{dovizSembol}0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>}
    </div>
  );
}

function TahvilBono({s,onGecmis}){
  const [tip,setTip]=useState("bireysel");
  const [kaydedildiTB,setKaydedildiTB]=useState(false); // bireysel | tuzel
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");       // gün cinsinden
  const [oran,setOran]=useState("");       // yıllık basit oran %

  const r=useCallback(()=>{
    const T=parseFloat(tutar), G=parseInt(vade), rt=parseFloat(oran);
    if(!T||!G||!rt) return null;

    // Dönemsel getiri oranı (basit, gün bazlı)
    const donemselOran = rt/100/365*G;          // dönem brüt oran
    const brutGetiri   = Math.round(T*donemselOran*100)/100;

    // Bireysel: %15 stopaj
    const stopajOran = 15;
    const stopaj = tip==="bireysel" ? Math.round(brutGetiri*(stopajOran/100)*100)/100 : 0;
    const netGetiri = brutGetiri - stopaj;
    const netTutar  = T + netGetiri;

    // Net yıllık oran (bireysel stopaj sonrası)
    const netYillikOran = (netGetiri/T)/G*365*100;

    // Tüzel: mevduat eşlenik oran
    // Mevduat üzerinde stopaj var (%10 varsayılan 365+), sukuk yok
    // Eşlenik = sukukun brüt getirisi ile aynı net getiriyi verecek mevduat oranı
    // net_mevduat = brut_mevduat * (1 - stopaj/100)
    // brut_mevduat = netGetiri/T / G * 365 * 100 / (1 - stopaj/100)
    const stopajMevduat = G<=180 ? s.stopajTL_0_180 : G<=365 ? s.stopajTL_181_365 : s.stopajTL_365plus;
    const eslenikMevduatOran = tip==="tuzel"
      ? (brutGetiri/T)/G*365*100 / (1 - stopajMevduat/100)
      : null;

    // MKK Nakit Ödeme Komisyonu: (anapara + brütGetiri) * 0.0001 + BSMV %0.5 (binde 5)
    const mkkBase  = Math.round((T + brutGetiri) * 0.0001 * 100) / 100;
    const mkkBsmv  = Math.round(mkkBase * 0.05 * 100) / 100;  // BSMV %5
    const mkkTopla = Math.round((mkkBase + mkkBsmv) * 100) / 100;

    // Yıllık bileşik oran
    const yillikBilesik = (Math.pow(1 + donemselOran, 365/G) - 1) * 100;

    return {
      T, G, rt, donemselOran:donemselOran*100,
      brutGetiri, stopaj, netGetiri, netTutar,
      netYillikOran, eslenikMevduatOran, stopajMevduat,
      mkkBase, mkkBsmv, mkkTopla, yillikBilesik
    };
  },[tutar,vade,oran,tip,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"bireysel",l:"Bireysel"},{v:"tuzel",l:"Tüzel"}]} value={tip} onChange={setTip}/>
        <Field label="Yatırım Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Gün)" value={vade} onChange={setVade} suffix="Gün"/>
        <Field label="Yıllık Basit Oran" value={oran} onChange={setOran} suffix="%"/>
      </Card>

      {r&&<Card>
        <SecTitle>Sukuk / Kira Sertifikası Getiri</SecTitle>

        {/* Dönemsel Getiri Oranı */}
        <div style={{background:C.blueLight,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{margin:0,fontSize:12,fontWeight:700,color:C.blue}}>Dönemsel Getiri Oranı ({r.G} gün)</p>
            <p style={{margin:0,fontSize:17,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>% {fmtN(r.donemselOran,4)}</p>
          </div>
        </div>

        <RRow label="Brüt Getiri" value={fmtTL(r.brutGetiri)} accent={C.orange} big/>

        {tip==="bireysel"&&<>
          <RRow label={`Stopaj (%${fmtN(15)})`} value={`- ${fmtTL(r.stopaj)}`} sub accent={C.red}/>
          <RRow label="MKK Nakit Ödeme Komisyonu" value={`- ${fmtTL(r.mkkTopla)}`} sub accent={C.red}/>
          <RRow label="Net Getiri (MKK Sonrası)" value={fmtTL(r.netGetiri - r.mkkTopla)} accent={C.green} big/>
          <RRow label="Vade Sonu Net Tutar" value={fmtTL(r.netTutar - r.mkkTopla)} accent={C.blue} big/>
          <RRow label="Net Yıllık Oran (Basit)" value={`% ${fmtN(r.netYillikOran)}`} sub accent={C.green}/>
          <RRow label={`Yıllık Bileşik Oran (${r.G} gün dönem)`} value={`% ${fmtN(r.yillikBilesik)}`} sub accent={C.teal}/>
        </>}

        {tip==="tuzel"&&<>
          <RRow label="Brüt Yıllık Oran (Basit)" value={`% ${fmtN(r.rt)}`} sub/>
          <RRow label={`Yıllık Bileşik Oran (${r.G} gün dönem)`} value={`% ${fmtN(r.yillikBilesik)}`} sub accent={C.teal}/>
          <RRow label="MKK Nakit Ödeme Komisyonu" value={`- ${fmtTL(r.mkkTopla)}`} sub accent={C.red}/>
          <RRow label="Net Getiri (MKK Sonrası)" value={fmtTL(r.netGetiri - r.mkkTopla)} accent={C.green} big/>
          <RRow label="Vade Sonu Net Tutar" value={fmtTL(r.netTutar - r.mkkTopla)} accent={C.blue} big/>
          {/* Mevduat eşlenik - en altta */}
          <div style={{background:"#F0EDF8",borderRadius:10,padding:"12px 14px",marginTop:12,border:`1px solid ${C.purple}`}}>
            <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              Mevduat Eşlenik Oran
            </p>
            <p style={{margin:"0 0 6px",fontSize:11,color:C.sub}}>
              Aynı net getiriyi elde etmek için gereken mevduat oranı (stopaj %{fmtN(r.stopajMevduat)} sonrası)
            </p>
            <p style={{margin:"0 0 8px",fontSize:22,fontWeight:900,color:C.purple,fontFamily:"monospace"}}>
              % {fmtN(r.eslenikMevduatOran)}
            </p>
            <div style={{background:"rgba(91,74,138,0.08)",borderRadius:8,padding:"8px 10px",borderLeft:`3px solid ${C.purple}`}}>
              <p style={{margin:0,fontSize:11,color:C.purple,fontWeight:600}}>
                ℹ️ Gelir, kurumsal vergi beyannamesinde beyan edilir. Stopaj uygulanmaz.
              </p>
            </div>
          </div>
        </>}
        {onGecmis&&<button onClick={()=>{onGecmis({modul:"Sukuk Kira Sertifikası",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Gün",oran:oran+"% (Yıllık)",sonuc:fmtTL(r?.brutGetiri),netGetiri:fmtTL(r?.netGetiri),aylikTaksit:"-",plan:[]});setKaydedildiTB(true);setTimeout(()=>setKaydedildiTB(false),2000);}} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:12,border:`1.5px solid ${kaydedildiTB?C.green:C.teal}`,background:kaydedildiTB?C.greenLight:C.tealLight,color:kaydedildiTB?C.green:C.teal,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
          {kaydedildiTB?"✅ Kaydedildi":"🕐 Geçmişe Kaydet"}
        </button>}
      </Card>}
    </div>
  );
}

// ─── AYARLAR ─────────────────────────────────────────────────────────────────
function Ayarlar({settings,onSave}){
  const [s,setS]=useState({...settings});
  // Allow empty/partial strings while typing; parse on actual save
  const upd=k=>v=>{
    if(v===""||v==="."||v==="-"||/[,.]$/.test(v)){
      setS(p=>({...p,[k]:v}));
    } else {
      const n=parseFloat(String(v).replace(",","."));
      setS(p=>({...p,[k]:isNaN(n)?v:n}));
    }
  };
  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>TL Mevduat Stopaj Oranları</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="0-180 Gün" value={s.stopajTL_0_180} onChange={upd("stopajTL_0_180")} suffix="%"/>
          <Field label="181-365 Gün" value={s.stopajTL_181_365} onChange={upd("stopajTL_181_365")} suffix="%"/>
          <Field label="365+ Gün" value={s.stopajTL_365plus} onChange={upd("stopajTL_365plus")} suffix="%"/>
        </div>
      </Card>
      <Card>
        <SecTitle>YP Mevduat Stopaj</SecTitle>
        <Field label="Tüm Vadeler" value={s.stopajYP_tum} onChange={upd("stopajYP_tum")} suffix="%"/>
      </Card>
      <Card>
        <SecTitle>Kredi Vergi Oranları</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Bireysel KKDF" value={s.bireyselKKDF} onChange={upd("bireyselKKDF")} suffix="%"/>
          <Field label="Bireysel BSMV" value={s.bireyselBSMV} onChange={upd("bireyselBSMV")} suffix="%"/>
          <Field label="Ticari KKDF" value={s.ticariKKDF} onChange={upd("ticariKKDF")} suffix="%"/>
          <Field label="Ticari BSMV" value={s.ticariBSMV} onChange={upd("ticariBSMV")} suffix="%"/>
        </div>
      </Card>
      <Card>
        <SecTitle>ZK Oranları (Referans)</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="TL Vadesiz/Kısa" value={s.zkTL_vadesiz} onChange={upd("zkTL_vadesiz")} suffix="%"/>
          <Field label="TL 6ay-1yıl" value={s.zkTL_6ay} onChange={upd("zkTL_6ay")} suffix="%"/>
          <Field label="YP Vadesiz" value={s.zkYP_vadesiz} onChange={upd("zkYP_vadesiz")} suffix="%"/>
          <Field label="YP 3ay+" value={s.zkYP_diger} onChange={upd("zkYP_diger")} suffix="%"/>
        </div>
      </Card>
      <Card>
        <SecTitle>Yıllık Fonlama Maliyeti</SecTitle>
        <Field label="Yıllık Fonlama Maliyeti" value={s.fonlamaMaliyeti} onChange={upd("fonlamaMaliyeti")} suffix="% Yıllık"/>
      </Card>
      <Card>
        <SecTitle>POS Referans Oranı (Tebliğ 2020/4)</SecTitle>
        <Field label="Aylık Referans Oran" value={s.referansOran} onChange={upd("referansOran")} suffix="%" hint="Azami %3,11 — MB her ay günceller"/>
        <Field label="BKM Takas (Interchange) Oranı" value={s.bkmTakas} onChange={upd("bkmTakas")} suffix="%" hint="POS hesaplamada kullanılır — BKM talimatına göre güncellenir"/>
        <Field label="Cari Hesap Kâr Payı Oranı (POS)" value={s.cariKarPayiOran} onChange={upd("cariKarPayiOran")} suffix="%" hint="POS analizinde cari hesap getiri hesabı için kullanılır"/>
        <Field label="Katılım Hesabı Kâr Payı Oranı (POS)" value={s.katilimKarPayiOran} onChange={upd("katilimKarPayiOran")} suffix="%" hint="POS analizinde vadeli katılım hesabı getiri hesabı için kullanılır"/>
        <div style={{background:C.blueLight,borderRadius:8,padding:"8px 10px",marginTop:4}}>
          <p style={{margin:0,fontSize:11,color:C.blue}}>Kredi kartı taksitsiz azami = Referans + %0,45 puan | Banka kartı azami = %1,04</p>
        </div>
      </Card>
      <button onClick={()=>{
          const cleaned=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,isNaN(parseFloat(String(v).replace(",","."))) ? 0 : parseFloat(String(v).replace(",","."))]));
          onSave(cleaned);
        }} style={{width:"100%",padding:"15px",borderRadius:14,border:"none",background:C.blue,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer"}}>
        Kaydet
      </button>

    </div>
  );
}

// ─── AI ASİSTAN ───────────────────────────────────────────────────────────────
const KB = [
  {
    keys:["tl zk","tl zorunlu","tl mevduat zk","tl mevduat zorunlu","vadesiz zk","vadesiz mevduat","tl katılım zk"],
    title:"TL Zorunlu Karşılık Oranları",
    content:`TL MEVDUAT / KATILIM FONU ZK ORANLARI:
• Vadesiz / İhbarlı / 1 aya kadar / 3 aya kadar: %17
• 6 aya kadar (dahil): %10
• 1 yıla kadar: %10
• 1 yıl ve üzeri: %10
• TCMB kur/fiyat koruma destekli (6 aya kadar): %40
• TCMB kur/fiyat koruma destekli (1 yıl+): %22
• TÜFE/ÜFE/TLREF endeksli değişken faizli hesaplar: %10

TL DİĞER YÜKÜMLÜLÜKLER:
• 1 yıla kadar (dahil): %8
• 3 yıla kadar (dahil): %5,5
• 3 yıldan uzun: %3
• Yurt dışı repo/kredi 1 aya kadar: %20
• Yurt dışı repo/kredi 3 aya kadar: %16
• Yurt dışı repo/kredi ve mevduat 1 yıla kadar: %14
• Ana ortaklığa ait vadesiz yurt dışı banka mevduatı: %0`
  },
  {
    keys:["yp zk","yp zorunlu","yp mevduat zk","döviz zk","yabancı para zk","döviz mevduat zk","yp katılım"],
    title:"YP Zorunlu Karşılık Oranları",
    content:`YP MEVDUAT / KATILIM FONU ZK ORANLARI:
• Vadesiz / İhbarlı / 1 aya kadar: %30
• 3 ay / 6 ay / 1 yıl / 1 yıl+: %26
• İlave ZK (yurt dışı bankalar ve kıymetli maden depo hariç): %2,5

YP DİĞER YÜKÜMLÜLÜKLER:
• 1 yıla kadar (dahil): %21
• 2 yıla kadar (dahil): %10
• 3 yıla kadar (dahil): %8
• 5 yıla kadar (dahil): %3
• 5 yıldan uzun: %0
• Yurt içi yerleşiklerle YP repo (1 yıla kadar): %25`
  },
  {
    keys:["tl finansman büyüme","tl kredi büyüme","tl büyüme sınır","kobi dışı büyüme","kobi büyüme","ihtiyaç büyüme","taşıt büyüme","tüketici büyüme","tl büyüme limit","tl istisna","tl muaf","tl finansman istisna"],
    title:"TL Finansman Büyüme Sınırları ve İstisnaları",
    content:`TL FİNANSMAN BÜYÜME SINIRI (29.03.2024–31.12.2026):
• KOBİ dışı işletmeler: %2 (iki haftada bir)
• KOBİ işletmeler: %4,5
• Tüketici ihtiyaç finansmanı: %3
• Tüketici taşıt finansmanı: %3

TL İSTİSNA FİNANSMANLAR (büyüme dışı):
✅ Net ihracatçı firmalara ihracat finansmanı (max 2 yıl)
✅ Döviz kazandırıcı hizmet finansmanı (max 2 yıl)
✅ İhracat reeskont finansmanları
✅ Yatırım Teşvik Belgeli yatırım finansmanı (min 2 yıl)
✅ Esnaf finansmanları
✅ Tarımsal finansmanlar
✅ Kamusal amaçlı finansmanlar (5018 sayılı Kanun)
✅ Savunma sanayi firmaları
✅ KOSGEB destekli finansmanlar
✅ Elektrik dağıtım lisanslı firmalar
✅ Başka bankada yeniden yapılandırılan finansmanların kapatılması
✅ Merkez Bankasınca uygun KGF kefaletli programlar`
  },
  {
    keys:["yp finansman büyüme","yp kredi büyüme","yp büyüme sınır","yabancı para büyüme","yp büyüme istisna","yp muaf","yp finansman istisna"],
    title:"YP Finansman Büyüme Sınırı ve İstisnaları",
    content:`YP FİNANSMAN BÜYÜME SINIRI: %0,5 (iki haftada bir)

YP İSTİSNA FİNANSMANLAR (büyüme dışı):
✅ YTB kapsamında makine-teçhizat yatırım finansmanı (min 2 yıl, faturaya bağlı)
✅ Otel yatırımı bina-inşaat finansmanı (min 2 yıl)
✅ Ağır ticari araç finansmanı (min 2 yıl)
✅ Uluslararası kalkınma kuruluşlarından makine-teçhizat finansmanı
✅ Yurt içi bankalara kullandırılan finansmanlar
✅ Gayrikabili rücu akreditif iskontosu (yurt dışı banka riskinde)
✅ Kamusal amaçlı finansmanlar
✅ Savunma sanayi firmaları
✅ KGF kefaletli ihracat finansmanları
✅ Elektrik dağıtım lisanslı firmalar
✅ Başka bankada yeniden yapılandırılan YP finansmanların kapatılması
✅ Hazine garantili kalkınma/yatırım bankası finansmanları
✅ Borç üstlenim anlaşması kapsamı projeler (min 2 yıl)
✅ Özelleştirme ihalesi kazananlara kullandırılan finansmanlar

⚠️ ÖNEMLİ: YP finansmanlarda NET İHRACATÇI muafiyeti YOKTUR.
Bu muafiyet SADECE TL finansmanlarda geçerlidir.`
  },
  {
    keys:["net ihracatçı","ihracat muaf","ihracat finansman muaf","ihracat kredi muaf","net ihracat"],
    title:"Net İhracatçı Firma TL Finansman Muafiyeti",
    content:`NET İHRACATÇI TANIMI:
Son 3 mali yıl VEYA son mali yılda ihracat/ithalat oranı ≥ %110 olan firmalar.
(Yatırım Malları Listesindeki ithalat bedelleri bu hesaba dahil edilmez.)

Net ihracatçılık şartı ARANMAYAN firmalar:
• Savunma sanayi firmaları
• Yüksek teknoloji ihracatı taahhüdü verenler
• Sevk sonrası ihracat finansmanı kullananlar
• İhracat alacak sigortasıyla başvuran yeni kurulan firmalar

UYGULAMA:
• Finansman vadesi en fazla 2 yıl olmalıdır
• Sorumluluk bankaya aittir
• Her yılın 4. ayı sonuna kadar net ihracatçılık güncellenir

⚠️ Bu muafiyet SADECE TL finansmanlarda geçerlidir.
YP finansmanlarda net ihracatçı muafiyeti YOKTUR.`
  },
  {
    keys:["yaptırım","ceza","eksik zk","eksik tesis","cezai faiz","yaptırım nedir"],
    title:"ZK Yaptırımları",
    content:`EKSİK ZK TESİSİNDE YAPTIRIM:
• Eksik TL ZK → 2 katı faizsiz TL bloke mevduat
• Eksik YP ZK → 3 katı faizsiz USD bloke mevduat
• Cezai faiz: TCMB en yüksek gecelik borç verme faizi × 1,50
• Tahakkuk eden cezai faizler ödenmezse 6183 sayılı Kanun'a göre tahsil edilir
• Sürekli ihlal eden kuruluşlara idari tedbirler uygulanır`
  },
  {
    keys:["faiz ödeme","telafi ödeme","zk faiz","karşılık faizi","nema","zk getiri","zk kazanç"],
    title:"ZK Faiz / Telafi Ödemesi",
    content:`TL ZK FAİZ / TELAFİ ÖDEMESİ:
• TL mevduat ZK'sı: TCMB ağırlıklı ort. fonlama maliyeti × 0,86
• Kur/fiyat koruma destekli hesap ZK'sı: TCMB maliyeti × 0,40
• 21 Aralık 2024 sonrası açılan/yenilenen kur koruma hesaplarına bu oran uygulanmaz
• Fazla tesis edilen tutarlara faiz ödenmez
• Ödeme: Her 3 ayda bir (Mart, Haziran, Eylül, Aralık sonu)
• Ödeme, takip eden ilk iş günü serbest mevduat hesabına aktarılır`
  },
  {
    keys:["stopaj","tevkifat","mevduat stopaj","kesinti","stopaj oranı"],
    title:"Mevduat Stopaj Oranları",
    content:`TL MEVDUAT STOPAJ ORANLARI:
• 0 – 180 gün: %17,5
• 181 – 365 gün: %15
• 365 gün üzeri: %10

YP MEVDUAT STOPAJ ORANLARI:
• Tüm vadeler: %25`
  },
  {
    keys:["kkdf","bsmv","vergi oranı","kredi vergi","finansman vergi","kkdf bsmv"],
    title:"KKDF ve BSMV Oranları",
    content:`TİCARİ FİNANSMAN:
• BSMV: %5
• KKDF: %0

BİREYSEL FİNANSMAN:
• BSMV: %15
• KKDF: %15`
  },
  {
    keys:["tesis dönem","hesaplama dönem","bildiri","cetvel","evas","bloke","zk300","tesis süresi"],
    title:"Tesis Dönemi ve Bildirim",
    content:`HESAPLAMA VE TESİS:
• Yükümlülükler: 2 haftada bir Cuma günü itibarıyla hesaplanır
• Tesis başlangıcı: Hesaplama tarihinden 2 hafta sonraki Cuma
• Tesis bitişi: Başlangıcı takip eden Perşembe (14 gün)

BİLDİRİM:
• ZK300H cetveli, EVAS ile öğlen 12:00'ye kadar gönderilir
• Bloke hesap hareketi varsa 1-2 iş günü öncesinde gönderilmesi önerilir

BLOKE ZK ZORUNLULUĞU (31.12.2026'ya kadar):
• Aktif ≥ 500 milyar TL: TL ZK'nın %40'ı bloke
• Aktif ≥ 100 milyar TL: TL ZK'nın %30'u bloke

AKTİF BÜYÜKLÜK İNDİRİMLERİ:
• Aktif < 300 milyar TL: TL ZK'dan 500 milyon TL indirim
• Aktif < 300 milyar TL: YP TL ZK'dan 250 milyon TL indirim`
  },
  {
    keys:["kmh","kredi mevduat","limit büyüme","kmh limit"],
    title:"KMH Limit Büyüme Sınırı (Geçici Madde 17)",
    content:`TÜKETİCİ KMH LİMİT BÜYÜME SINIRI:
• %1 (8 haftada bir hesaplanır)
• 5 milyar TL altı KMH limiti olan bankalar hariçtir
• Geçerlilik: 27.03.2026 – 31.12.2026`
  },
  {
    keys:["erken kapama","erken ödeme","erken ödeme cezası","erken ödeme ücreti","kapama cezası","kredi kapatma","erken kapatma"],
    title:"Erken Ödeme Ücreti (Tebliğ 2020/4 — Madde 11 & Geçici Maddeler)",
    content:`TİCARİ KREDİLERDE ERKEN ÖDEME ÜCRETİ (Tebliğ 2020/4, Madde 11):

▶ 30.06.2024 SONRASI KULLANDIRILAN KREDİLER (Madde 11/3):
• Sabit faizli TL kredi: MB Talimatıyla belirlenen formülle hesaplanan oranda
  (Faiz oranı × kalan ağırlıklı ort. vade bazlı; pratikte azami ~%2)
• Sabit faizli YP/dövize endeksli: Sabit bir oran × kalan ağırlıklı ort. vade (MB Talimatı)
• Değişken faizli (tüm para birimleri): Erken ödenen tutarın azami %2'si

▶ 01.03.2021 – 30.06.2024 ARASI KULLANDIRILAN KREDİLER (Geçici Madde 5/2):
• Kalan vade ≤ 24 ay: %2
• Kalan vade > 24 ay: %2 + her ilave tam yıl için +%1
  (Örn: kalan 36 ay → %2 + %1 = %3; kalan 48 ay → %2 + %2 = %4)
• YP/dövize endeksli: TL oranına +%1 ilave uygulanır

▶ 01.03.2021 ÖNCESİ KULLANDIRILAN KREDİLER (Geçici Madde 5/1):
• Kalan vade ≤ 24 ay: %1
• Kalan vade > 24 ay: %2
• YP/dövize endeksli: +%1 ilave uygulanır

GENEL KURALLAR:
✅ Banka, müşterinin tüm krediyi erken kapatma talebini kabul ETMEK ZORUNDADIR
✅ Erken ödeme anında tahakkuk etmeyen faiz ve diğer maliyetlere ilişkin indirim yapılır
✅ Kısmi erken ödeme de mümkündür; bankadan indirim talep edilebilir
⛔ Bu ücretler sadece erken ödenen tutar üzerinden alınır`
  },
  {
    keys:["kredi tahsis","kullandırım ücreti","tahsis ücreti","kredi ücreti","kredi komisyonu"],
    title:"Kredi Tahsis ve Kullandırım Ücreti (Tebliğ 2020/4 — Madde 9)",
    content:`KREDİ TAHSİS ÜCRETİ (Madde 9/1):
• Azami: Tahsis edilen kredi limitinin %0,20'si
• Yıllık oran; vade ay sayısına oransal uygulanır
• Limit artışında sadece ilave limit üzerinden yeni ücret alınabilir
• Limit talebi müşteriden gelmeden tahsis ücreti alınamaz
• Gayri nakdi krediler dahil tüm kredi limitleri için uygulanır

KREDİ KULLANDIRIMI ÜCRETİ (Madde 9/2):
• Sadece nakdi kredilerden alınır
• Azami: Kullandırılan TL kredinin %1,10'u
• Rotatif kredilerde: Ortalama kullandırım bakiyesi üzerinden yıllık
• Bir yıldan kısa vadeli: Vade gün sayısına oransal düşürülür
• YP kredilerde kullandırım ücreti serbestçe belirlenebilir`
  },
  {
    keys:["teminat","ekspertiz","ipotek ücreti","rehin ücreti","teminat ücreti"],
    title:"Teminatlandırma Ücreti (Tebliğ 2020/4 — Madde 10)",
    content:`TEMİNATLANDIRMA ÜCRETİ (Madde 10):
• Taşınır/taşınmaz rehin ve ipotek tesisleri + ekspertiz işlemleri
• Azami: 3. kişilere ödenen tutarın %15 fazlası
• Hizmet banka bünyesinde sunuluyorsa: Hizmetin makul bedeli`
  },
  {
    keys:["eft ücreti","havale ücreti","fast ücreti","para transferi ücreti","transfer ücreti"],
    title:"Para Transferi Ücretleri (Tebliğ 2020/4 — Madde 15)",
    content:`EFT AZAMİ ÜCRETLERİ (Madde 15 — 06.01.2026 güncel):
≤ 8.300 TL:
  Mobil/İnternet/Düzenli Ödeme: 7,97 TL
  ATM/Kiosk: 27,84 TL
  Diğer kanallar: 39,87 TL

8.300,01 – 399.000 TL:
  Mobil/İnternet/Düzenli Ödeme: 15,96 TL
  ATM/Kiosk: 55,69 TL
  Diğer kanallar: 79,76 TL

399.000 TL Üzeri:
  Mobil/İnternet/Düzenli Ödeme: 199,41 TL
  ATM/Kiosk: 398,83 TL
  Diğer kanallar: 797,68 TL

HAVALE: EFT azami ücretlerinin yarısı
FAST: EFT ile aynı azami limitler
⛔ Hesaptan hesaba işyeri ödemelerinde GÖNDERENden ücret alınamaz`
  },
  {
    keys:["üye işyeri","pos komisyonu","pos ücreti","üye işyeri ücreti","mdm komisyon"],
    title:"Üye İşyeri Ücretleri (Tebliğ 2020/4 — Madde 20)",
    content:`ÜYE İŞYERİ ÜCRETLERİ (Madde 20):
• Kredi kartı taksitsiz (ertesi gün valör): Referans oran + 0,45 puan azami
• Banka kartı (ertesi gün valör): Azami %1,04
• Yurt dışı ihraçlı kartlar: Azami %1,90
• Taksitli işlemler: Taksitsiz ücret + her taksit için en fazla %50 ilave

REFERANS ORAN (Madde 20/A):
• Her ayın sondan 5. iş günü MB tarafından ilan edilir
• Azami: %3,11
• %5'ten fazla değişirse güncellenir

TİCARİ KART KURALLARI (Madde 21):
⛔ Limit aşım ücreti alınamaz
• Nakit avans ücreti: Azami %1
⛔ Ekstre erteleme, taksitlendirme, son ödeme tarihi uzatma ücreti alınamaz
✅ Bankalar ÜCRETSİZ ticari kredi kartı sunmak ZORUNDADIR
• Ek kart yıllık üyelik ücreti: Asıl kartın azami %50'si`
  },
  {
    keys:["ticari ücret tebliğ","2020/4","ticari müşteri ücret","banka ücret tebliğ","ücret bilgilendirme"],
    title:"Tebliğ 2020/4 Genel Çerçeve",
    content:`TİCARİ MÜŞTERİLERDEN ALINABİLECEK ÜCRETLER TEBLİĞİ (2020/4):
Son güncelleme: 31.01.2026 tarihli ve 33154 sayılı RG (2026/5 sayılı Tebliğ)

KAPSAM:
• Mali kuruluşlar dışındaki ticari müşterilere sunulan ürün ve hizmetler
• 4 ana kategori: Ticari Krediler, Dış Ticaret, Nakit Yönetimi, Ödeme Sistemleri

BİLGİLENDİRME KURALLARI (Madde 5 & 7):
• Ücretler internet sitesinde açık ve anlaşılır şekilde ilan edilir
• Ücret artışları en az 2 iş günü önceden bildirilir
• Artışlar geçmişe uygulanamaz

GENEL YASAKLAR:
⛔ Ek-1 dışındaki kategorilerde başka adlarla ücret alınamaz
⛔ Ürün/hizmet sunulamaması halinde (müşterinin vazgeçmesi hariç) iade yapılır
• Paket içindeki ürünlerin toplam ücreti ayrı ayrı azami fiyatları aşamaz`
  },
  {
    keys:["bilgilendirme esası","ücret bildirimi","ilan zorunluluğu","dekont","işlem fişi","sözleşme bilgilendirme","madde 5"],
    title:"Bilgilendirme Esasları (Tebliğ 2020/4 — Madde 5)",
    content:`BİLGİLENDİRME ESASLARI (Madde 5):
• Azami tarifeler bankaların internet sitesinde açık, anlaşılır ve kolay erişilebilir şekilde ilan edilir
• Birlikler ücret bilgilerini toplu olarak kendi internet sitesinde yayımlar
• Azami tarifelerdeki değişiklikler uygulamadan önce MB'ye bildirilir; bildirilen üzeri ücret alınamaz
• Sözleşmelerde bilgilendirme formu zorunludur; form sözleşmenin ayrılmaz parçasıdır
• Hizmet sunulmadan önce müşteriye tahsil edilecek ücret tutarı bildirilmek zorundadır
• Şubede: işlem sonrası dekont veya fişin imzalanması bilgilendirme yükümlülüğünü karşılar
• İşlem fişinde ücret bilgisine açıkça yer verilir
• Fatura/ekstre/sözleşme kopyaları ayrıca ücretlendirilemez (3. kişi maliyetleri hariç)
• Bankalar müşteri onaysız bildirimden ücret alamaz
• İspat yükü bankaya aittir`
  },
  {
    keys:["ücret değişiklik","artış bildirimi","madde 7","ücret artış","tarife güncelleme"],
    title:"Ücretlerin Değiştirilmesi (Tebliğ 2020/4 — Madde 7)",
    content:`ÜCRETLERİN DEĞİŞTİRİLMESİ (Madde 7):
• Ücret artışları uygulamadan en az 2 iş günü önce müşteriye yazılı veya kalıcı veri saklayıcısıyla bildirilir
• Artışlar geçmiş döneme uygulanamaz
• Maktu parasal sınırlar ve azami ücretler her yıl TÜFE oranında MB tarafından artırılır
• 06.01.2026 itibarıyla EFT/Havale/FAST sınırları TÜFE ile güncellenmiştir`
  },
  {
    keys:["dış ticaret","akreditif","ihracat","ithalat","gayri nakdi","madde 12","vesaik","aval"],
    title:"Dış Ticaret Ücretleri (Tebliğ 2020/4 — Madde 12 & Ek-1)",
    content:`DIŞ TİCARET KATEGORİSİ (Madde 12):
• İhracat ve ithalat işlemleri kapsamında sunulan gayri nakdi krediler ve diğer hizmetler

İTHALAT İŞLEMLERİ (Ek-1):
• Akreditif Açılış Ücreti
• Rezerv/Uyuşmazlık Ücreti
• Ön İhbar Ücreti
• Aval/Kabul Ücreti
• Vade/Tutar Değişiklik Ücreti
• Poliçe Kabul Ücreti

İHRACAT İŞLEMLERİ (Ek-1):
• İhbar Ücreti
• Teyit Ücreti
• Vade/Tutar Değişikliği Ücreti
• Vadeli Ödeme Ücreti
• İskonto Ücreti
• Tahsil Ücreti

ORTAK İŞLEMLER (Ek-1):
• Vesaik İnceleme Ücreti
• Değişiklik Ücreti
• İşlem Ücreti
• Muhabir Banka Masrafı
• Ödeme Ücreti

NOT: Dış ticaret kapsamındaki gayri nakdi krediler (akreditif ve banka kabul/avali) ticari krediler kategorisi dışındadır`
  },
  {
    keys:["nakit yönetimi","madde 13","madde 14","hesap açılış","para yatırma","mevduat hesap","atm ücret"],
    title:"Nakit Yönetimi — Hesap ve ATM (Tebliğ 2020/4 — Madde 13-14)",
    content:`NAKİT YÖNETİMİ (Madde 13):
Nakit pozisyon takibi, hesap hizmetleri, para transferleri, ödeme ve tahsilat ürünleri

MEVDUAT/KATILIM FONU HESAPLARI (Madde 14):
⛔ Hesap açılış, işletim, saklama ve bilgi işlem yatırımları için ücret alınamaz
⛔ Para yatırma işlemlerinden (saat 15:30 öncesi şube dahil) ücret alınamaz
  İSTİSNA: Şube kanalıyla 15:30 SONRASI para yatırma ücretlendirilebilir
⛔ Müşterinin kendi bankasının ATM'sinden bakiye sorgulama ve para çekme ücretsizdir
• Başka banka ATM'si: Ödenen tutarın azami %15 fazlası alınabilir`
  },
  {
    keys:["kiralık kasa","madde 16","kasa depozito","kasa ziyaret"],
    title:"Kiralık Kasa (Tebliğ 2020/4 — Madde 16)",
    content:`KİRALIK KASA (Madde 16):
• Sözleşme ile belirlenen hizmetler karşılığında kira ücreti alınabilir
⛔ Kiralık kasa ziyaretinden ücret alınamaz
• Depozito: Bir yıllık kira bedelini aşamaz
• Hizmet sonunda hasar, ödenmemiş kira ve diğer borçlar düşülerek kalan iade edilir`
  },
  {
    keys:["aracılık","fatura tahsilat","madde 17","faturaödeme","gönderen ücret"],
    title:"Aracılık Hizmetleri (Tebliğ 2020/4 — Madde 17)",
    content:`ARACILIK HİZMETLERİ (Madde 17):
⛔ Fatura ve benzeri tahsilatlara aracılık işlemlerinde ÖDEME YAPAN ticari müşteriden ücret alınamaz
✅ Bankalar tahsilatına aracılık yapılan taraftan (alacaklıdan) ücret talep edebilir`
  },
  {
    keys:["belge talep","ekstre","sözleşme kopyası","madde 18","geçmiş evrak"],
    title:"Belge ve Bilgilendirme Ücreti (Tebliğ 2020/4 — Madde 18)",
    content:`BELGE VE BİLGİLENDİRME (Madde 18):
• Sözleşme/fiş/belge kopyası talebi — ilk 1 yıl: Yalnızca 3. kişilere ödenen tutarlar alınabilir
• 1 yılı geçen belge talepleri: Müşteriye bilgi verilerek işlemle orantılı makul ücret alınabilir
• Basılı ekstre: 3. kişilere ödenen tutar kadar (banka bünyesinde: makul bedel)`
  },
  {
    keys:["çek","senet","çek defteri","senet protesto","çek iade","madde 3","çek işlem"],
    title:"Çek ve Senet İşlemleri (Tebliğ 2020/4 — Ek-1)",
    content:`ÇEK İŞLEMLERİ (Ek-1, 3.7):
• Çek Defteri ve Çek Düzenleme Ücreti
• Çek İade Ücreti
• Çek Tahsilatı Ücreti
• Çek Belgelendirme ve Düzeltme İşlemleri Ücreti

SENET İŞLEMLERİ (Ek-1, 3.8):
• Senet Bilgilendirme Ücreti
• Senet İade Ücreti
• Senet Protesto İşlemleri Ücreti
• Senet Tahsile Alma Ücreti`
  },
  {
    keys:["pos ücreti","sanal pos","fiziki pos","kayıp pos","pos donanım","madde 19"],
    title:"POS Ücretleri (Tebliğ 2020/4 — Madde 19 & Ek-1)",
    content:`POS ÜCRETLERİ (Ek-1, 4.1):
• POS Yazılım/Donanım/Bakım Ücreti — Fiziki POS
• POS Yazılım/Donanım/Bakım Ücreti — Sanal POS
• Kayıp/Hasarlı POS ve Aksesuar Bedeli

NOT: Üye işyeri ücreti dışında mal/hizmet tutarı üzerinden başka ücret alınamaz (Madde 20/7)
Üye işyerinin onayıyla kart sahibine aktarılmak üzere alınan ücretler istisnası vardır`
  },
  {
    keys:["tedarikçi finansmanı","dbs","doğrudan borçlandırma","tedarikçi"],
    title:"Tedarikçi Finansmanı ve DBS (Tebliğ 2020/4 — Ek-1)",
    content:`TEDARİKÇİ FİNANSMANI VE DBS (Ek-1, 3.1):
• Tedarikçi Finansmanı ve DBS Ücreti
• Tedarikçi Finansmanı ve DBS Dönem Ücreti

DBS (Doğrudan Borçlandırma Sistemi): Alıcı firmanın onayıyla tedarikçilerin alacaklarının erken tahsili`
  },
  {
    keys:["proje finansman","yapılandırılmış finansman","satın alım birleşme","özelleştirme finansman","madde 8"],
    title:"Ticari Krediler Kapsamı Dışı (Tebliğ 2020/4 — Madde 8/2)",
    content:`TİCARİ KREDİLER KATEGORİSİ DIŞINDA KALAN KREDİLER (Madde 8/2):
Aşağıdakiler için özel sözleşme veya protokol kapsamında kullandırılan krediler ticari krediler kategorisi dışındadır:
• Proje finansmanı
• Satın alım ve birleşme finansmanı
• Özelleştirme finansmanı
• Yapılandırılmış finansman
• Bunların refinansmanı`
  },
];

function normalize(s){
  return (s||"").toLowerCase()
    .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ş/g,"s")
    .replace(/ç/g,"c").replace(/ö/g,"o").replace(/ü/g,"u");
}

function findAnswer(q){
  const qn=normalize(q);
  const words=qn.split(/\s+/).filter(w=>w.length>2);
  
  let bestScore=0, bestItem=null;
  
  for(const item of KB){
    let score=0;
    for(const key of item.keys){
      const kn=normalize(key);
      // Full phrase match - highest score
      if(qn.includes(kn)) score+=10;
      // Word overlap
      const kwords=kn.split(/\s+/);
      const overlap=words.filter(w=>kwords.some(kw=>kw.includes(w)||w.includes(kw))).length;
      score+=overlap*2;
    }
    if(score>bestScore){bestScore=score;bestItem=item;}
  }
  
  if(bestScore>=4) return bestItem;
  
  // Fallback: single keyword
  for(const item of KB){
    if(item.keys.some(k=>words.some(w=>normalize(k).includes(w)&&w.length>3))){
      return item;
    }
  }
  return null;
}

const MODUL_ICON = {
  "Konut Finansmanı":"🏠","Taşıt Finansmanı":"🚗","Yatırım Fonu Finansmanı":"📦",
  "Togg Finansmanı":"⚡","Arsa/İşyeri Finansmanı":"🏢","Spot Finansman":"💼",
  "Taksitli Ticari Finansman":"🏦","Finansal Kiralama":"📋",
  "Katılım Hesabı Getiri":"💰","Sukuk Kira Sertifikası":"📈",
};

function GecmisPlanModal({plan, baslik}){
  const [open, setOpen] = useState(false);
  const plan_rows = plan.filter(p=>p&&!p._toplamSabitTaksit);
  const fmt=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);

  const metin = [
    baslik + " — Ödeme Planı",
    "---",
    "Ay | Taksit | Kâr Payı | Anapara | Kalan",
    ...plan_rows.map((p,i)=>`${i+1}. ay — ${fmt(p.taksit||p.toplam)} — ${fmt(p.karPayi||p.faiz||0)} — ${fmt(p.anapara||0)} — ${fmt(p.bakiye||0)}`),
    "---",
    "Bu hesaplamalar bilgilendirme amaçlıdır.",
  ].join("\n");

  const kopyala=()=>{
    navigator.clipboard.writeText(metin).catch(()=>{
      const ta=document.createElement("textarea");ta.value=metin;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);
    });
  };

  return(<>
    <div style={{height:1,background:"#2A3A4A",margin:"12px 0"}}/>
    <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #2A3A4A",background:"#1C2A38",color:"#64748B",fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
      <span>📅</span> Ödeme Planını Görüntüle ({plan_rows.length} taksit)
    </button>

    {open&&(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end"}}>
        <div style={{background:"#0F1923",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #2A3A4A",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <span style={{fontSize:14,fontWeight:800,color:"#E2E8F0"}}>📅 {baslik} — Ödeme Planı</span>
            <button onClick={()=>setOpen(false)} style={{background:"#1C2A38",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer",color:"#94A3B8"}}>×</button>
          </div>
          {/* Tablo */}
          <div style={{flex:1,overflowY:"auto",padding:"8px 12px 16px"}}>
            <div style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"7px 8px",borderRadius:"8px 8px 0 0"}}>
              {["Ay","Taksit","Kâr Payı","Anapara","Kalan"].map((h,i)=>(
                <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>0?"right":"center"}}>{h}</span>
              ))}
            </div>
            {plan_rows.map((p,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 1fr 1fr",padding:"6px 8px",background:i%2===0?"#1C2A38":"#162030"}}>
                <span style={{fontSize:9,color:"#64748B",textAlign:"center"}}>{p.ay||i+1}</span>
                {[p.taksit||p.toplam, p.karPayi||p.faiz||0, p.anapara||0, p.bakiye||0].map((v,vi)=>(
                  <span key={vi} style={{fontSize:9,color:"#E2E8F0",textAlign:"right",fontFamily:"monospace"}}>{fmt(v)}</span>
                ))}
              </div>
            ))}
          </div>
          {/* Paylaş */}
          <div style={{padding:"12px 16px",borderTop:"1px solid #2A3A4A",flexShrink:0}}>
            <button onClick={async()=>{
              const blob=new Blob([metin],{type:"text/plain"});
              const file=new File([blob],baslik+".txt",{type:"text/plain"});
              if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
                try{ await navigator.share({title:baslik,text:metin,files:[file]}); return; }catch(e){}
              }
              if(navigator.share){
                try{ await navigator.share({title:baslik,text:metin}); return; }catch(e){}
              }
              kopyala();
            }} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"#2563EB",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span>⬆️</span> Paylaş
            </button>
            <p style={{margin:"6px 0 0",fontSize:10,color:"#64748B",textAlign:"center"}}>Mail, WhatsApp veya Dosyalar'a kaydedebilirsiniz.</p>
          </div>
        </div>
      </div>
    )}
  </>);
}

function Gecmis({gecmis, onTemizle, nav}){
  const [secili, setSecili] = useState(null);

  if(gecmis.length===0) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"calc(100vh - 200px)",padding:24,textAlign:"center"}}>
      <p style={{fontSize:48,margin:"0 0 12px"}}>🕐</p>
      <p style={{fontSize:18,fontWeight:800,color:C.label,margin:"0 0 8px"}}>Henüz hesaplama yok</p>
      <p style={{fontSize:14,color:C.sub,margin:0}}>Bir finansman veya getiri hesaplaması yaptığınızda burada görünür.</p>
    </div>
  );

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Detay Modal */}
      {secili&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:16,fontWeight:800,color:C.label}}>{MODUL_ICON[secili.modul]||"📊"} {secili.modul}</span>
              <button onClick={()=>setSecili(null)} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 18px 28px"}}>
              <p style={{margin:"0 0 14px",fontSize:11,color:C.sub}}>{secili.tarih}</p>
              {[
                {l:"Tutar", v:secili.tutar},
                {l:"Vade", v:secili.vade},
                {l:"Oran", v:secili.oran},
                secili.aylikTaksit!=="-"?{l:"Aylık Taksit", v:secili.aylikTaksit}:null,
                (["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(secili.modul))&&secili.sonuc?{l:"Brüt Getiri", v:secili.sonuc, big:!secili.netGetiri}:null,
                (["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(secili.modul))&&secili.netGetiri?{l:"Net Getiri", v:secili.netGetiri, big:true}:null,
                !(["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(secili.modul))?{l:"Toplam Maliyet", v:secili.sonuc, big:true}:null,
              ].filter(Boolean).map((row,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,color:C.sub,fontWeight:600}}>{row.l}</span>
                  <span style={{fontSize:row.big?17:14,fontWeight:row.big?900:700,color:row.big?C.blue:C.label,fontFamily:"monospace"}}>{row.v}</span>
                </div>
              ))}
              {secili.plan&&secili.plan.length>0&&(
                <GecmisPlanModal plan={secili.plan} baslik={secili.modul}/>
              )}
              {/* Paylaş butonu — plan yoksa (Katılım Getiri gibi) */}
              {(!secili.plan||secili.plan.length===0)&&(
                <button onClick={async()=>{
                  const metin=[
                    secili.modul,
                    "Tarih: "+secili.tarih,
                    "---",
                    "Tutar: "+secili.tutar,
                    "Vade: "+secili.vade,
                    "Oran: "+secili.oran,
                    secili.aylikTaksit&&secili.aylikTaksit!=="-"?"Aylık Taksit: "+secili.aylikTaksit:"",
                    secili.sonuc?"Sonuç: "+secili.sonuc:"",
                    secili.netGetiri?"Net Getiri: "+secili.netGetiri:"",
                    "---",
                    "Bu hesaplamalar bilgilendirme amaçlıdır.",
                  ].filter(Boolean).join("\n");
                  if(navigator.share){
                    try{ await navigator.share({title:secili.modul,text:metin}); return; }catch(e){}
                  }
                  navigator.clipboard?.writeText(metin);
                }} style={{width:"100%",marginTop:16,padding:"13px",borderRadius:12,border:"none",background:C.blue,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span>⬆️</span> Paylaş
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div style={{paddingTop:8}}>
        {gecmis.map((g,i)=>(
          <div key={g.id} onClick={()=>setSecili(g)} style={{
            background:C.card, borderRadius:14, padding:"13px 16px", marginBottom:10,
            boxShadow:"0 1px 4px rgba(0,0,0,0.06)", cursor:"pointer",
            borderLeft:`3px solid ${C.blue}`,
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <p style={{margin:"0 0 3px",fontSize:13,fontWeight:800,color:C.label}}>
                  {MODUL_ICON[g.modul]||"📊"} {g.modul}
                </p>
                <p style={{margin:"0 0 6px",fontSize:11,color:C.sub}}>{g.tarih}</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:C.sub,background:"#F5F6F8",borderRadius:6,padding:"2px 7px"}}>{g.tutar}</span>
                  <span style={{fontSize:11,color:C.sub,background:"#F5F6F8",borderRadius:6,padding:"2px 7px"}}>{g.vade}</span>
                  <span style={{fontSize:11,color:C.sub,background:"#F5F6F8",borderRadius:6,padding:"2px 7px"}}>{g.oran}</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <p style={{margin:0,fontSize:11,color:C.sub,marginBottom:2}}>
                  {["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(g.modul)?"Brüt Getiri":"Toplam"}
                </p>
                <p style={{margin:0,fontSize:14,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{g.sonuc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Temizle */}
      {gecmis.length>0&&(
        <button onClick={()=>onTemizle()}
          style={{width:"100%",marginTop:8,padding:"12px",borderRadius:12,border:`1.5px solid ${C.red}`,background:"#FEF2F2",color:C.red,fontWeight:700,fontSize:13,cursor:"pointer"}}>
          🗑 Geçmişi Temizle
        </button>
      )}
    </div>
  );
}

const SOZLUK_KATEGORILER = ["Tümü","Akad & Fıkıh","Finansman Yöntemleri","Hesap Türleri","Menkul Kıymet","Vergi & Kesinti","Bankacılık","Katılım Bankacılığı"];

const SOZLUK_DATA = [
  // ── AKAD & FIKIH ──────────────────────────────────────────────────────────
  {terim:"Akit",tanim:"Hukukî sonuç doğurmak amacıyla iki veya daha fazla tarafın karşılıklı ve birbirine uygun irade beyanlarıyla kurduğu sözleşme. Katılım bankacılığındaki tüm işlemler geçerli bir akde dayanır.",kategori:"Akad & Fıkıh",en:"Contract",ar:"عقد"},
  {terim:"Beyi (Bey')",tanim:"Satış; mal ya da satılabilir bir hakkın bedel karşılığı bir başkasına devredilmesi. Katılım bankacılığının temelini oluşturan meşru kazanç yollarından biridir.",kategori:"Akad & Fıkıh",en:"Sale",ar:"بيع"},
  {terim:"Caiz",tanim:"Meşru, yapılabilir, dinen sakıncasız olan şey. Katılım bankacılığında kullanılan ürün ve sözleşmelerin caiz olması zorunludur.",kategori:"Akad & Fıkıh",en:"Permissible",ar:"جائز"},
  {terim:"Faiz (Riba)",tanim:"Borçtan elde edilen gelir; verilen ödünç paranın üzerine şart koşulan fazlalık. İslamiyet'te borçtan gelir sağlamak yasaklanmıştır; ticaret ise helaldir.",kategori:"Akad & Fıkıh",en:"Interest / Usury",ar:"ربا"},
  {terim:"Garar",tanim:"Belirsizlik hali, bilinmezlik, meçhuliyet. Sözleşmenin konusu veya bedelinin belirsiz olması durumudur. Aşırı garar içeren işlemler İslam hukukunda yasaklanmıştır.",kategori:"Akad & Fıkıh",en:"Uncertainty",ar:"غرر"},
  {terim:"Haram",tanim:"Dinen yasak olan, yapılması kesinlikle uygun görülmeyen iş veya fiil. Faiz içeren, spekülatif ve topluma zararlı işlemler katılım bankacılığında haramdır.",kategori:"Akad & Fıkıh",en:"Prohibited",ar:"حرام"},
  {terim:"Kâr-Zarar Ortaklığı",tanim:"Müşteri ile katılım bankasının belirli bir faaliyetin ya da malın alım-satımından doğacak kâr ve zarara birlikte katılması esasına dayanan finansman modeli.",kategori:"Akad & Fıkıh",en:"Profit-Loss Sharing",ar:"مشاركة في الربح والخسارة"},
  {terim:"Karz",tanim:"Borç, para borcu. Karz işlemi menfaat karşılığı olamaz; borç verilen para yalnızca aynen geri alınabilir, fazlası faiz sayılır.",kategori:"Akad & Fıkıh",en:"Loan",ar:"قرض"},
  {terim:"Karz-ı Hasen",tanim:"Faizsiz borç verme; verilen ödünçten hiçbir fazlalık talep etmeme. Yalnızca anapara geri alınır. Enflasyon farkı talep etmek meşru kabul edilmektedir.",kategori:"Akad & Fıkıh",en:"Benevolent Loan",ar:"قرض حسن"},
  {terim:"Kabz",tanim:"Teslim almak; satın alınan malı fiilen ya da hükmen ele geçirmek. Gerçek kabz malın bizzat alınmasıdır. Hükmi kabz ise mal üzerinde tasarruf hakkının elde edilmesidir.",kategori:"Akad & Fıkıh",en:"Possession / Delivery",ar:"قبض"},
  {terim:"Vekâlet",tanim:"Bir kişinin başkası adına işlem yapmasına olanak tanıyan yetki devri sözleşmesi. Katılım bankalarında yatırım hesapları ve dış ticaret işlemlerinde yaygın kullanılır.",kategori:"Akad & Fıkıh",en:"Agency",ar:"وكالة"},
  {terim:"Kefalet",tanim:"Bir borcun ya da yükümlülüğün ifa edileceğine dair güvence verme; kefil olma. Teminat mektuplarının İslam hukukundaki karşılığıdır.",kategori:"Akad & Fıkıh",en:"Guarantee / Surety",ar:"كفالة"},
  {terim:"İne Satışı",tanim:"Peşin bedelle satılan bir malın vadeli bedelle geri alınması. Faiz hilesine yol açtığı gerekçesiyle İslam alimlerinin çoğunluğunca meşru görülmemektedir.",kategori:"Akad & Fıkıh",en:"Bay al-Inah",ar:"بيع العينة"},
  {terim:"İcma",tanim:"İslam müçtehitlerinin belirli bir dönemde pratik bir meselenin dinî hükmü üzerinde görüş birliğine varması. Katılım bankacılığı ürünleri bu ilkeye dayanılarak geliştirilmektedir.",kategori:"Akad & Fıkıh",en:"Scholarly Consensus",ar:"إجماع"},

  // ── FİNANSMAN YÖNTEMLERİ ────────────────────────────────────────────────
  {terim:"Murabaha",tanim:"Katılım bankasının müşteri adına satın aldığı mal veya hizmeti, maliyet üzerine önceden belirlenen bir kâr marjı ekleyerek vadeli satması. Türkiye'de kurumsal finansman desteği olarak uygulanır.",kategori:"Finansman Yöntemleri",en:"Cost-Plus Financing",ar:"مرابحة"},
  {terim:"Mudaraba",tanim:"Bir tarafın sermaye (rab-ül-mal), diğer tarafın emek ve yönetimi (mudarip) ortaya koyduğu ortaklık. Kâr önceden belirlenen oranla paylaşılır; zarar yalnızca sermayeye yüklenir.",kategori:"Finansman Yöntemleri",en:"Profit-Sharing Investment",ar:"مضاربة"},
  {terim:"Müşaraka",tanim:"Her iki tarafın hem sermaye hem de yönetime katıldığı ortaklık modeli. Kâr ve zarar, katılım oranlarına göre paylaşılır. Azalan müşaraka konut finansmanında kullanılır.",kategori:"Finansman Yöntemleri",en:"Partnership / Equity Participation",ar:"مشاركة"},
  {terim:"İcara (Leasing)",tanim:"Banka varlığı satın alır, müşteriye belirli bir kira bedeli karşılığında kullandırır. Vade sonunda mülkiyet devredilebilir. Türkiye'de finansal kiralama adıyla uygulanmaktadır.",kategori:"Finansman Yöntemleri",en:"Leasing",ar:"إجارة"},
  {terim:"Selem",tanim:"Ürünün teslimi gelecekte yapılmak üzere bedelin peşin ödendiği satış sözleşmesi. Tarımsal ürünler ve standart malların finansmanında kullanılır.",kategori:"Finansman Yöntemleri",en:"Forward Sale",ar:"سلم"},
  {terim:"İstisna",tanim:"Henüz üretilmemiş ya da inşa edilmemiş bir mal/projenin sipariş üzerine finansmanını kapsayan sözleşme. İnşaat, imalat ve altyapı projelerinde yaygın kullanılır.",kategori:"Finansman Yöntemleri",en:"Manufacturing Finance",ar:"استصناع"},
  {terim:"Teverruk",tanim:"Nakit ihtiyacı için kullanılan; bankanın vadeli sattığı bir malın müşteri tarafından spot piyasada üçüncü kişiye satılmasına dayanan işlem. Fıkıh çevrelerinde tartışmalıdır.",kategori:"Finansman Yöntemleri",en:"Commodity Murabaha",ar:"تورق"},
  {terim:"Azalan Müşaraka",tanim:"Bankanın zamanla azalan ortaklık payını müşteriye devrettiği; konut finansmanında kullanılan azalan ortaklık modeli. Müşteri taksit ödedikçe bankanın payı küçülür.",kategori:"Finansman Yöntemleri",en:"Diminishing Musharaka",ar:"المشاركة المتناقصة"},

  // ── HESAP TÜRLERİ ────────────────────────────────────────────────────────
  {terim:"Katılım Hesabı (Katılma Hesabı)",tanim:"Katılım bankasına yatırılan fonların kâr/zarar ortaklığı esasına göre değerlendirildiği hesap. Vade sonunda getiri garantisi yoktur; banka kâr etmişse pay dağıtılır.",kategori:"Hesap Türleri",en:"Participation Account",ar:"حساب المشاركة"},
  {terim:"Özel Cari Hesap",tanim:"İstenildiğinde kısmen veya tamamen çekilebilen, karşılığında herhangi bir getiri ödenmeyen hesap türü. Vadesiz hesabın katılım bankacılığındaki karşılığıdır.",kategori:"Hesap Türleri",en:"Current Account",ar:"حساب جاري"},
  {terim:"Vadeli Katılım Hesabı",tanim:"Belirli bir süre için bankaya yatırılan ve vade sonunda kâr payıyla birlikte geri alınan hesap. Vade seçenekleri 1 ay ile 5 yıl arasında değişir.",kategori:"Hesap Türleri",en:"Term Deposit Account",ar:"حساب الودائع الآجلة"},
  {terim:"Günlük Hesap",tanim:"Her gün değerleme yapılan, istenildiğinde çekilebilen ve günlük kâr payı işleyen hesap türü. Belirli bir bakiyenin cari bloke olarak ayrılması gerekmektedir.",kategori:"Hesap Türleri",en:"Daily Account",ar:"حساب يومي"},
  {terim:"Birim Değeri",tanim:"Katılma hesabının izlendiği endeks değeri. İlk açılışta 100 kabul edilir; kâr edildiğinde yükselir, zarar edildiğinde düşer. Vade sonundaki getiriyi hesaplamada kullanılır.",kategori:"Hesap Türleri",en:"Unit Value",ar:"القيمة الوحدوية"},
  {terim:"Birim Hesap Değeri",tanim:"Katılım hesabının cari değerini gösteren tutar. Birim Değeri × Hesap Değeri formülüyle hesaplanır. Müşterinin o an itibarıyla hak iddia edebileceği meblağdır.",kategori:"Hesap Türleri",en:"Unit Account Value",ar:"قيمة حساب الوحدة"},
  {terim:"Cari Bloke",tanim:"Günlük hesap açılışında belirlenen bakiye bandına göre hesapta bloke tutulan zorunlu tutar. Bu tutar üzerinden getiri hesaplanmaz; yalnızca nakde hazır tutar olarak bekletilir.",kategori:"Hesap Türleri",en:"Current Block",ar:"رصيد محجوز"},
  {terim:"Kâr Payı",tanim:"Katılım bankacılığında yatırımın getirisini ifade eden pay. Banka, topladığı fonları meşru ticaret ve ortaklık yöntemleriyle değerlendirir; elde ettiği kârı belirlenen paylaşım oranıyla hesap sahiplerine dağıtır.",kategori:"Hesap Türleri",en:"Profit Share",ar:"نصيب الربح"},
  {terim:"Standart Oran (85/15)",tanim:"Katılım hesaplarında banka ile müşteri arasındaki kâr paylaşım oranı. 85/15; toplam kârın %85'inin müşteriye, %15'inin bankaya ait olduğunu ifade eder.",kategori:"Hesap Türleri",en:"Distribution Ratio",ar:"نسبة التوزيع"},
  {terim:"Katılım Fonu",tanim:"Katılım bankasındaki özel cari ve katılma hesaplarında bulunan toplam para. Bu fonların faizsiz enstrümanlarla değerlendirilmesi zorunludur.",kategori:"Hesap Türleri",en:"Participation Fund",ar:"صندوق المشاركة"},

  // ── MENKUL KIYMET ────────────────────────────────────────────────────────
  {terim:"Sukuk (Kira Sertifikası)",tanim:"Varlığa dayalı İslami finansal araç. Belirli bir varlığın mülkiyetine ya da kira gelirine ortak olmayı sağlar. Getiri, borç ilişkisinden değil; varlıktan elde edilen kira veya kârdan kaynaklanır. Türkiye'de hazine ve özel sektör sukuku ihraç edilmektedir.",kategori:"Menkul Kıymet",en:"Sukuk / Islamic Bond",ar:"صكوك"},
  {terim:"İcara Sukuku",tanim:"Kira gelirine dayanan ve en yaygın kullanılan sukuk türü. Türkiye'de 'kira sertifikası' adıyla bilinen sukuk türü esasen bu yapıdadır. Sabit kira geliri sağlar.",kategori:"Menkul Kıymet",en:"Lease-Based Sukuk",ar:"صكوك الإجارة"},
  {terim:"Katılım Yatırım Fonu",tanim:"Katılım finans ilkelerine uygun hisse senedi, kira sertifikası ve altın gibi araçlara yatırım yapan fon. BDDK ve SPK denetiminde faaliyet gösterir.",kategori:"Menkul Kıymet",en:"Participation Investment Fund",ar:"صندوق الاستثمار المشترك"},
  {terim:"Katılım Endeksi (KATLM)",tanim:"BİST'te işlem gören ve katılım bankacılığı prensiplerine uygun hisse senetlerinden oluşan borsa endeksi. Alkol, faiz ve şans oyunlarına bağlı şirketler dışlanır.",kategori:"Menkul Kıymet",en:"Participation Index",ar:"مؤشر المشاركة"},
  {terim:"Tekafül",tanim:"İslam hukukuna uygun sigorta sistemi. Katılımcıların belirledikleri bir havuza prim yatırarak risklere karşı birbirini güvence altına alması esasına dayanır.",kategori:"Menkul Kıymet",en:"Islamic Insurance",ar:"تكافل"},

  // ── VERGİ & KESİNTİ ──────────────────────────────────────────────────────
  {terim:"BSMV (Banka ve Sigorta Muameleleri Vergisi)",tanim:"Bankaların finansal işlemleri üzerinden alınan vergi. Bireysel kredilerin kâr payı üzerinden %15 oranında uygulanır. Kurumsal işlemlerde de geçerlidir.",kategori:"Vergi & Kesinti",en:"Banking and Insurance Transaction Tax",ar:"ضريبة معاملات البنوك والتأمين"},
  {terim:"KKDF (Kaynak Kullanımı Destekleme Fonu)",tanim:"Bireysel tüketici kredilerinden yapılan kesinti. Konut ve taşıt kredilerinde oran sıfır iken diğer bireysel kredilerde %15 oranında uygulanır.",kategori:"Vergi & Kesinti",en:"Resource Utilization Support Fund",ar:"صندوق دعم استخدام الموارد"},
  {terim:"Stopaj (Gelir Vergisi Tevkifatı)",tanim:"Yatırım gelirlerinden kaynakta kesilen vergi. Bireysel katılım hesapları için vadeye göre %0 ile %17,5 arasında uygulanır. Tüzel kişilerde stopaj uygulanmaz.",kategori:"Vergi & Kesinti",en:"Withholding Tax",ar:"ضريبة الاستقطاع"},
  {terim:"KDV (Katma Değer Vergisi)",tanim:"Finansal kiralama işlemlerinde varlığın türüne göre uygulanan vergi. Taşınmaz kiralamasında %1, taşınabilir varlıklarda farklı oranlar geçerli olabilir.",kategori:"Vergi & Kesinti",en:"Value Added Tax",ar:"ضريبة القيمة المضافة"},

  // ── BANKACILIK ───────────────────────────────────────────────────────────
  {terim:"LTV (Loan to Value / Finansman-Değer Oranı)",tanim:"Finansman tutarının teminat değerine oranı. %70 LTV, 1.000.000 TL değerli bir varlık için en fazla 700.000 TL finansman kullandırılabileceği anlamına gelir. BDDK tarafından sınırlıdır.",kategori:"Bankacılık",en:"Loan to Value Ratio",ar:"نسبة القرض إلى القيمة"},
  {terim:"ZK (Zorunlu Karşılık)",tanim:"Bankaların mevduatlarına karşılık TCMB'de bloke tutmak zorunda olduğu fon. Bu fonlar bankalar tarafından kullanılamaz; efektif getiri oranını ve maliyet hesaplamalarını etkiler.",kategori:"Bankacılık",en:"Reserve Requirement",ar:"الاحتياطي الإلزامي"},
  {terim:"Ekspertiz Değeri",tanim:"Bağımsız uzman tarafından belirlenen taşınmaz veya araç değeri. LTV hesaplamalarında esas alınır; piyasa değerinden farklı olabilir.",kategori:"Bankacılık",en:"Appraisal Value",ar:"قيمة التقييم"},
  {terim:"BDDK (Bankacılık Düzenleme ve Denetleme Kurumu)",tanim:"Türkiye'de bankacılık sektörünü düzenleyen ve denetleyen bağımsız idari otorite. LTV oranları, vade sınırları ve özkaynak yeterliliği BDDK tarafından belirlenir.",kategori:"Bankacılık",en:"Banking Regulation and Supervision Agency",ar:"هيئة تنظيم ومراقبة البنوك"},
  {terim:"TCMB (Türkiye Cumhuriyet Merkez Bankası)",tanim:"Para politikasını belirleyen ve zorunlu karşılık oranlarını yöneten merkezi otorite. Katılım bankaları da TCMB denetimi ve düzenlemelerine tabidir.",kategori:"Bankacılık",en:"Central Bank of the Republic of Türkiye",ar:"البنك المركزي للجمهورية التركية"},
  {terim:"MKK (Merkezi Kayıt Kuruluşu) Komisyonu",tanim:"Sukuk/kira sertifikası nakit ödemelerinde alınan komisyon. Formülü: (Anapara + Brüt Getiri) × ‱1 + BSMV (%5). Her iki taraf için de geçerlidir.",kategori:"Bankacılık",en:"Central Securities Depository Commission",ar:"عمولة مركز الإيداع المركزي"},
  {terim:"BKM (Bankalararası Kart Merkezi)",tanim:"Türkiye'de kartlı ödeme altyapısını yöneten kuruluş. POS takas komisyonunu belirler; bankaların POS karlılık analizinin temelini oluşturur.",kategori:"Bankacılık",en:"Interbank Card Center",ar:"مركز البطاقات بين البنوك"},
  {terim:"Efektif Yıllık Oran",tanim:"Dönemsel bileşik getiriyi yıllık bazda ifade eden oran. Formülü: (1 + dönemsel oran)^(365/gün) - 1. Basit yıllık orana kıyasla gerçek maliyeti veya getiriyi daha iyi yansıtır.",kategori:"Bankacılık",en:"Effective Annual Rate",ar:"معدل الفائدة السنوي الفعلي"},
  {terim:"Kredi Kullandırım Ücreti",tanim:"Finansman tahsisinde bankaya ödenen ücret. Bireysel ürünlerde bireysel azami %0,50'dir; vade 12 aydan kısa ise oransal olarak hesaplanır.",kategori:"Bankacılık",en:"Loan Origination Fee",ar:"رسوم منح الائتمان"},
  {terim:"Akreditif",tanim:"Uluslararası ticarette ihracatçıya ödeme güvencesi sağlayan belgesel kredi aracı. Katılım bankalarında 'teyit mektubu' adıyla faizsiz yapıya uygun düzenlenir.",kategori:"Bankacılık",en:"Letter of Credit",ar:"خطاب اعتماد"},
  {terim:"Teminat Mektubu",tanim:"Bankanın müşteri adına lehdara karşı güvence verdiği belge. Kefalete dayanır. Geçici, kesin ve avans teminat mektubu türleri mevcuttur.",kategori:"Bankacılık",en:"Letter of Guarantee",ar:"خطاب ضمان"},

  // ── KATILIM BANKACILIĞI ──────────────────────────────────────────────────
  {terim:"Katılım Bankacılığı",tanim:"Kâr/zarar ortaklığı ve meşru ticaret yöntemlerini esas alan bankacılık sistemi. Fon toplamada ve kullandırmada her para hareketi mutlaka bir mal, hizmet veya varlığa dayanır; gelir ticaret ve ortaklıktan elde edilir.",kategori:"Katılım Bankacılığı",en:"Participation Banking / Islamic Banking",ar:"المصرفية الإسلامية"},
  {terim:"Faizsiz Bankacılık",tanim:"Katılım bankacılığının diğer adı. Faiz içermeyen; parasal işlemlerin mutlaka bir mal, hizmet veya varlığa dayandırıldığı bankacılık sistemi.",kategori:"Katılım Bankacılığı",en:"Interest-Free Banking",ar:"المصرفية الخالية من الفوائد"},
  {terim:"Danışma Komitesi (Dini Kurul)",tanim:"Katılım bankalarının ürün ve hizmetlerinin faizsiz finans ilkelerine uygunluğunu denetleyen ve fetva veren kurul. Bağımsız İslam hukukçularından oluşur.",kategori:"Katılım Bankacılığı",en:"Shariah Advisory Board",ar:"لجنة الفتوى الشرعية"},
  {terim:"TKBB (Türkiye Katılım Bankaları Birliği)",tanim:"Türkiye'deki katılım bankalarını temsil eden sektör kuruluşu. Standart geliştirme, eğitim ve kamuoyu bilgilendirme faaliyetleri yürütür.",kategori:"Katılım Bankacılığı",en:"Participation Banks Association of Türkiye",ar:"اتحاد مصارف المشاركة التركية"},
  {terim:"Özel Finans Kurumu (ÖFK)",tanim:"1983–2005 yılları arasında katılım bankalarının Türkiye'deki resmi adı. 5411 sayılı Bankacılık Kanunu ile 'katılım bankası' adını almışlardır.",kategori:"Katılım Bankacılığı",en:"Special Finance House",ar:"مؤسسة التمويل الخاصة"},
  {terim:"Mudarip",tanim:"Mudaraba ortaklığında sermayeyi işleten ve yöneten taraf. Katılım bankası bu rolü üstlenerek müşteri fonlarını meşru yollarla değerlendirir.",kategori:"Katılım Bankacılığı",en:"Fund Manager (Mudarib)",ar:"مضارب"},
  {terim:"Rab-ül-Mal",tanim:"Mudaraba ortaklığında sermayeyi sağlayan taraf. Katılım hesabında müşteri bu rolü üstlenir; emek ve yönetimi bankaya bırakır.",kategori:"Katılım Bankacılığı",en:"Capital Provider",ar:"رب المال"},
];

function Sozluk(){
  const [ara,setAra]=useState("");
  const [kategori,setKategori]=useState("Tümü");
  const [acik,setAcik]=useState(null);

  const filtre=SOZLUK_DATA.filter(d=>{
    const aramaTutar=ara.length===0||d.terim.toLowerCase().includes(ara.toLowerCase())||d.tanim.toLowerCase().includes(ara.toLowerCase())||(d.en&&d.en.toLowerCase().includes(ara.toLowerCase()));
    const katFil=kategori==="Tümü"||d.kategori===kategori;
    return aramaTutar&&katFil;
  });

  const KATRENKler={"Akad & Fıkıh":"#7C3AED","Finansman Yöntemleri":"#1D4ED8","Hesap Türleri":"#065F46","Menkul Kıymet":"#9A3412","Vergi & Kesinti":"#B45309","Bankacılık":"#1E40AF","Katılım Bankacılığı":"#166534"};
  const katRenk=(k)=>KATRENKler[k]||C.blue;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 112px)",background:"#0F1923"}}>
      {/* Arama */}
      <div style={{padding:"10px 14px 6px",background:"#0F1923",flexShrink:0}}>
        <div style={{position:"relative",marginBottom:8}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15}}>🔍</span>
          <input type="text" value={ara} onChange={e=>setAra(e.target.value)}
            placeholder="Türkçe, İngilizce veya açıklama ara..."
            style={{width:"100%",boxSizing:"border-box",padding:"11px 36px 11px 36px",fontSize:13,fontWeight:500,background:"#1C2A38",border:"1.5px solid #2A3A4A",borderRadius:12,color:"#fff",outline:"none"}}/>
          {ara&&<button onClick={()=>setAra("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#94A3B8",fontSize:18,cursor:"pointer"}}>×</button>}
        </div>
        {/* Kategori filtreleri */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {SOZLUK_KATEGORILER.map(k=>(
            <button key={k} onClick={()=>setKategori(k)} style={{
              flexShrink:0,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
              background:kategori===k?(k==="Tümü"?"#2563EB":katRenk(k)):"#1C2A38",
              color:kategori===k?"#fff":"#94A3B8",
              transition:"all 0.15s"
            }}>{k}</button>
          ))}
        </div>
        <p style={{margin:"5px 0 0 2px",fontSize:10,color:"#64748B"}}>
          {filtre.length} terim · {ara||kategori!=="Tümü"?`${SOZLUK_DATA.length} içinden filtrelendi`:"Toplam kayıt"}
        </p>
      </div>

      {/* Liste */}
      <div style={{flex:1,overflowY:"auto",padding:"4px 12px 24px"}}>
        {filtre.length===0?(
          <div style={{textAlign:"center",padding:"48px 20px"}}>
            <p style={{fontSize:36,margin:"0 0 10px"}}>🔍</p>
            <p style={{color:"#94A3B8",fontSize:14,margin:0}}><strong style={{color:"#E2E8F0"}}>"{ara}"</strong> için sonuç bulunamadı</p>
          </div>
        ):filtre.map((d,i)=>(
          <div key={i} onClick={()=>setAcik(acik===i?null:i)} style={{
            background:"#1C2A38",borderRadius:14,padding:"13px 15px",marginBottom:8,
            borderLeft:`3px solid ${katRenk(d.kategori)}`,cursor:"pointer",
            transition:"background 0.15s",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <p style={{margin:"0 0 3px",fontSize:14,fontWeight:800,color:"#E2E8F0"}}>{d.terim}</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:9,fontWeight:700,color:katRenk(d.kategori),background:"rgba(255,255,255,0.06)",padding:"2px 7px",borderRadius:10}}>{d.kategori}</span>
                  {d.en&&<span style={{fontSize:9,color:"#64748B",padding:"2px 7px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>{d.en}</span>}
                </div>
              </div>
              <span style={{color:"#475569",fontSize:14,marginLeft:8,flexShrink:0}}>{acik===i?"▲":"▼"}</span>
            </div>
            {acik===i&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #2A3A4A"}}>
                <p style={{margin:"0 0 8px",fontSize:12,color:"#94A3B8",lineHeight:1.6}}>{d.tanim}</p>
                {d.ar&&<p style={{margin:0,fontSize:13,color:"#64748B",textAlign:"right",fontFamily:"serif",direction:"rtl"}}>{d.ar}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function Asistan({nav}){
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Merhaba! Ben VK Asistanıyım.\n\n📋 ZK Uygulama Talimatı (17.06.2026) ve Ücretler Tebliği (2020/4) bilgi tabanım yüklendi.\n\nÖrnek sorular:\n• TL finansman büyüme sınırı nedir?\n• Net ihracatçı muafiyeti YP'de de geçerli mi?\n• Eksik ZK yaptırımı ne olur?\n• %60 TL kredi mi %10 YP kredi mi mantıklı?\n• Murabaha nedir?",ekler:[]}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef();

  // ── Modül yönlendirme ─────────────────────────────────────────────────────
  const MODUL_MAP=[
    {keys:["konut","mortgage","ev finansman"],screen:"konutFinansman",label:"Konut Finansmanı"},
    {keys:["taşıt","araç","otomobil","araba"],screen:"tasitFinansman",label:"Taşıt Finansmanı"},
    {keys:["togg"],screen:"toggFinansman",label:"Togg Finansmanı"},
    {keys:["leasing","finansal kiralama"],screen:"leasing",label:"Finansal Kiralama"},
    {keys:["spot"],screen:"spotFinansman",label:"Spot Finansman"},
    {keys:["taksitli ticari","ticari finansman"],screen:"taksitliTicari",label:"Taksitli Ticari Finansman"},
    {keys:["pos","komisyon","üye işyeri"],screen:"posHesaplama",label:"POS Komisyon Analizi"},
    {keys:["sukuk","kira sertifikası"],screen:"tahvilBono",label:"Sukuk Kira Sertifikası"},
    {keys:["katılım hesabı","vadeli hesap","vadeli hesap"],screen:"vadeliKatilim",label:"Katılım Hesabı Getiri"},
    {keys:["teminat mektubu"],screen:"tmKomisyon",label:"Teminat Mektubu Komisyon"},
    {keys:["akreditif"],screen:"akreditifKomisyon",label:"Akreditif Komisyon"},
    {keys:["yatırım fonu"],screen:"yatirimFonuFinansman",label:"Yatırım Fonu Finansmanı"},
    {keys:["arsa","işyeri"],screen:"arsaIsyeri",label:"Arsa/İşyeri Finansmanı"},
    {keys:["zk","zorunlu karşılık"],screen:"verimlilikAnalizi",label:"Verimlilik Analizi"},
  ];

  // ── Yakın terim ───────────────────────────────────────────────────────────
  const YAKIN=[
    {yanlis:["murapha","murabaha","mürabaha"],dogru:"Murabaha"},
    {yanlis:["müşereke","müşarka","musaraka"],dogru:"Müşaraka"},
    {yanlis:["mudarebe","mudaraba"],dogru:"Mudaraba"},
    {yanlis:["sukk","sükük","sukük"],dogru:"Sukuk"},
    {yanlis:["icare","icara","ijara"],dogru:"İcara (Finansal Kiralama)"},
    {yanlis:["zk oranı","zorunlu karşılık oranı"],dogru:"Zorunlu Karşılık (ZK)"},
    {yanlis:["kkdf","kaynak kullanımı fonu"],dogru:"KKDF"},
    {yanlis:["bsmv","banka sigorta vergisi"],dogru:"BSMV"},
    {yanlis:["ltv","loan to value"],dogru:"LTV (Finansman-Değer Oranı)"},
  ];

  // ── Sözlük tanımları ──────────────────────────────────────────────────────
  const SOZLUK_KISA={
    "murabaha":"Bankanın müşteri adına aldığı malı maliyet + kâr marjıyla vadeli satması. Katılım bankacılığının temel finansman yöntemi.",
    "mudaraba":"Bir tarafın sermaye, diğerinin emek koyduğu ortaklık. Kâr paylaşılır, zarar sermayeye yüklenir.",
    "müşaraka":"Her iki tarafın sermaye ve yönetime katıldığı ortaklık. Kâr ve zarar katılım oranına göre paylaşılır.",
    "sukuk":"Varlığa dayalı İslami finansal araç. Kira sertifikası olarak da bilinir.",
    "icara":"Finansal kiralama. Banka varlığı alır, kira karşılığı kullandırır.",
    "karz-ı hasen":"Faizsiz borç. Sadece anapara geri alınır.",
    "vekalet":"Yetki devri sözleşmesi. Banka adına işlem yapma yetkisi.",
    "kefalet":"Güvence verme; teminat mektubunun İslami karşılığı.",
    "tekafül":"İslami sigorta sistemi. Karşılıklı yardım esasına dayanır.",
    "garar":"Belirsizlik, meçhuliyet. Aşırı garar içeren işlemler yasaktır.",
  };

  // ── Finansal analiz ───────────────────────────────────────────────────────
  const analizYap=(q)=>{
    const ql=q.toLowerCase();
    // TL vs YP karşılaştırması
    if((ql.includes("tl")&&ql.includes("yp"))||(ql.includes("tl")&&ql.includes("döviz"))){
      const tlOran=parseFloat(q.match(/(%\d+|\d+%)/)?.[0])||null;
      return `💡 **TL vs YP Kredi Analizi**

ZK Talimatı'na göre temel farklar:

**TL Finansman:**
• ZK oranı: %17 (vadesiz/kısa vadeli)
• KKDF: %15 bireysel, tüzel için 0
• BSMV: %15 kâr payı üzerinden
• TL büyüme sınırı: TCMB tarafından belirlenir

**YP Finansman:**
• YP ZK oranı: %25 (vadesiz/kısa vadeli)
• KKDF: Genellikle 0
• Kur riski: Müşteri üstlenir
• Net ihracatçı muafiyeti YP'de geçerli

${tlOran?`%${tlOran} TL oranı için:`:""}Genel kural: YP finansman kur riskini dışarıda bırakırsan daha düşük maliyetli olabilir, ancak kur farkı riski TL'ye göre çok daha yüksektir. Kurumsal müşterilerde YP geliri varsa YP finansman tercih edilir.

❓ Daha detaylı analiz için finansman tutarı ve vadesini paylaşın.`;
    }
    // Maliyet analizi
    if(ql.includes("maliyet")&&(ql.includes("hesap")||ql.includes("analiz"))){
      return `💡 **Finansman Maliyet Analizi**

Toplam maliyet = Anapara + Kâr Payı + BSMV + KKDF + Kredi Kullandırım Komisyonu

• BSMV: Kâr payının %15'i
• KKDF: Bireysel kredilerde kâr payının %15'i (konut/taşıt hariç)
• Kullandırım Komisyonu: Max %0.50 bireysel, %1.10 ticari

📐 Detaylı hesaplama için ilgili finansman modülünü kullanın.`;
    }
    return null;
  };

  // ── Yerel yanıt üret ─────────────────────────────────────────────────────
  const yerelYanit=(q)=>{
    const ql=q.toLowerCase();

    // 1. Sözlük araması
    for(const [terim,tanim] of Object.entries(SOZLUK_KISA)){
      if(ql.includes(terim)){
        return {text:`📖 **${terim.charAt(0).toUpperCase()+terim.slice(1)}**

${tanim}`,tip:"sozluk"};
      }
    }

    // 2. KB araması
    const found=findAnswer(q);
    if(found){
      return {text:`📋 **${found.title}**

${found.content}`,tip:"kb"};
    }

    // 3. Finansal analiz
    const analiz=analizYap(q);
    if(analiz) return {text:analiz,tip:"analiz"};

    // 4. Bulunamadı
    return {text:`Üzgünüm, "${q.slice(0,40)}..." sorusuna bilgi tabanımda yanıt bulamadım.

Yardımcı olabileceğim konular:
• ZK oranları ve uygulaması
• Finansman ücretleri (KKDF, BSMV, komisyon)
• Katılım bankacılığı terimleri
• TL/YP finansman karşılaştırması

💼 Konuyla ilgili daha fazla bilgi için bölge veya segment temsilcinizle iletişime geçebilirsiniz.`,tip:"bulunamadi"};
  };

  // ── Yardımcılar ───────────────────────────────────────────────────────────
  const findYakin=(q)=>{
    const ql=q.toLowerCase();
    for(const t of YAKIN){if(t.yanlis.some(y=>ql.includes(y)))return t.dogru;}
    return null;
  };

  const findModul=(text)=>{
    const tl=text.toLowerCase();
    for(const m of MODUL_MAP){if(m.keys.some(k=>tl.includes(k)))return m;}
    return null;
  };

  // ── Gönder ───────────────────────────────────────────────────────────────
  const send=async()=>{
    const q=input.trim();
    if(!q||loading)return;
    setInput("");
    const newMsgs=[...msgs,{role:"user",text:q,ekler:[]}];
    setMsgs(newMsgs);
    setLoading(true);

    await new Promise(r=>setTimeout(r,400)); // düşünüyor efekti

    const yakin=findYakin(q);
    const {text,tip}=yerelYanit(q);
    const modul=findModul(q+" "+text);

    const ekler=[];
    if(yakin) ekler.push({tip:"oneri",text:`💡 "${yakin}" terimini mi sormak istediniz?`});
    if(modul) ekler.push({tip:"modul",text:`📐 ${modul.label} → Hesaplamaya Git`,screen:modul.screen,label:modul.label});
    if(tip==="bulunamadi") ekler.push({tip:"uyari",text:"⚠️ Bu konu bilgi tabanımda yer almıyor. Bölge veya segment temsilcinizle iletişime geçebilirsiniz."});

    setMsgs(p=>[...p,{role:"assistant",text,ekler}]);
    setLoading(false);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 112px)"}}>
      <div style={{padding:"9px 16px",background:C.blueLight,borderBottom:`1px solid ${C.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>🤖</span>
        <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>VK Asistan · ZK Talimatı 17.06.2026 · Çevrimdışı</p>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:12}}>
            <div style={{maxWidth:"92%"}}>
              <div style={{padding:"10px 14px",
                borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                background:m.role==="user"?C.blue:C.card,
                color:m.role==="user"?"#fff":"#1C1C1E",
                fontSize:14,lineHeight:1.65,
                boxShadow:"0 1px 3px rgba(0,0,0,0.08)",
                whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                {m.text}
              </div>
              {m.ekler?.map((ek,ei)=>(
                <div key={ei} style={{marginTop:6}}>
                  {ek.tip==="modul"?(
                    <button onClick={()=>nav(ek.screen)} style={{width:"100%",padding:"9px 14px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                      📐 {ek.label} → Hesaplamaya Git
                    </button>
                  ):(
                    <div style={{padding:"8px 12px",borderRadius:10,fontSize:12,lineHeight:1.5,
                      background:ek.tip==="uyari"?"#FEF2F2":ek.tip==="oneri"?"#F0F5FF":"#F0FDF4",
                      color:ek.tip==="uyari"?C.red:ek.tip==="oneri"?C.blue:C.green,
                      border:`1px solid ${ek.tip==="uyari"?"#FCA5A5":ek.tip==="oneri"?C.border:"#BBF7D0"}`,
                    }}>{ek.text}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",justifyContent:"flex-start",marginBottom:12}}>
            <div style={{padding:"12px 18px",borderRadius:"18px 18px 18px 4px",background:C.card,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
              <span style={{fontSize:18,letterSpacing:4,color:C.sub}}>· · ·</span>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>
      <div style={{padding:"10px 16px 24px",background:C.card,borderTop:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="ZK, KKDF, finansman terimleri..."
            rows={2}
            style={{flex:1,padding:"10px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:15,background:"#F9F9FB",outline:"none",resize:"none",fontFamily:"-apple-system,sans-serif",lineHeight:1.4}}/>
          <button onClick={send} disabled={loading||!input.trim()}
            style={{width:42,height:42,borderRadius:21,border:"none",background:input.trim()&&!loading?C.blue:C.border,color:"#fff",fontSize:18,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
        </div>
      </div>
    </div>
  );
}

function TaksitliTicariFinansman({s,onGecmis}){
  const [doviz,setDoviz]=useState("TL");
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const [showPlan,setShowPlan]=useState(false);

  const SABIT_KULLANIRIM=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const fmtDoviz=(n)=>n==null?"—":`${dovizSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  // Döviz değişince komisyon sıfırla
  useEffect(()=>{ setKullKomisyon("1.10"); },[doviz]);

  // TL: vade değişince azami komisyonu doldur
  const prevVadeRef=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRef.current){
      prevVadeRef.current=vade;
      if(doviz==="TL"){
        const V=parseInt(vade);
        if(V>0){
          // Taksitli: aylık vade, 12 aydan az ise oransal
          const gunEquiv=V*30;
          const azami=gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM;
          setKullKomisyon(fmtN(azami,4).replace(",","."));
        }
      }
    }
  },[vade]);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseFloat(vade),rt=parseFloat(oran);
    if(!T||!V||!rt)return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;

    // TL: BSMV/KKDF var, YP: yok
    const bsmvR=doviz==="TL"?s.ticariBSMV:0;
    const kkdfR=doviz==="TL"?s.ticariKKDF:0;

    const taksit=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamOdeme=taksit*V;
    const toplamKarPayi=toplamOdeme-T;
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const bsmvTL=toplamKarPayi*(bsmvR/100);

    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan?plan._toplamSabitTaksit:taksit;
    const toplamVadeMaliyet=aylikTaksit?Math.round(aylikTaksit*V*100)/100:toplamOdeme+kkdfTL+bsmvTL;

    // Komisyon
    const kullOranGiris=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azamiKull=doviz==="TL"?(gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM):null;
    const kullOranUyg=doviz==="TL"?Math.min(kullOranGiris,azamiKull):kullOranGiris;
    const kullAsim=doviz==="TL"&&kullOranGiris>azamiKull;
    const kullUcret=kullOranGiris>0?Math.round(T*(kullOranUyg/100)*100)/100:0;

    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;

    // Plan satırlarına komisyon ekle (sadece ilk satırda peşin)
    if(plan&&kullUcret>0) plan[0]={...plan[0],komisyon:kullUcret};

    // Efektif yıllık maliyet - bisection yöntemi (kararlı IRR)
    // Müşteri taksiti BSMV dahil, anapara komisyon düşülmüş
    const taksitBrutMusteri = taksit * (1 + bsmvR/100);
    const T_net = T - kullUcret; // müşterinin kullandığı gerçek tutar
    let efektifAylik=0;
    if(T_net>0&&V>0&&taksitBrutMusteri>0){
      let lo=0.0001/12, hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=taksitBrutMusteri*(1-Math.pow(1+mid,-V))/mid;
        if(pv>T_net) lo=mid; else hi=mid;
      }
      efektifAylik=(lo+hi)/2;
    }
    const efektifYillik=efektifAylik>0?Math.round((Math.pow(1+efektifAylik,12)-1)*10000)/100:0;

    return{taksit,aylikTaksit,toplamKarPayi,toplamOdeme,kkdfTL,bsmvTL,plan,
      toplamVadeMaliyet,toplamMaliyet,efektifYillik,
      kullUcret,kullOranUyg,kullAsim,azamiKull,bsmvR,kkdfR};
  },[tutar,vade,oran,tip,doviz,kullKomisyon,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani
        plan={r.plan} bsmvOran={r?.bsmvR||0} kkdfOran={r?.kkdfR||0}
        onClose={()=>setShowPlan(false)} showKomisyon={r?.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik}
       anaparaTutar={parseFloat(tutar)}/>}
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {/* Kullandırım Komisyonu */}
        <div style={{marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const gunEquiv=V*30;
                const azami=gunEquiv>0&&gunEquiv<365?1.10*(gunEquiv/365):1.10;
                setKullKomisyon(doviz==="TL"&&val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {doviz==="TL"
              ? (vade?`TL azami: %${fmtN(r?.azamiKull??SABIT_KULLANIRIM,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"TL — Madde 9/2, oransal tavan")
              : "YP — Tavan yok, serbestçe belirlenebilir (Madde 9/2)"}
          </p>
          {r?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&<>
        <Card>
          <SecTitle>Kâr Payı & Vergi {doviz!=="TL"&&`(${doviz})`}</SecTitle>
          {r.taksit&&<RRow label="Aylık Taksit (Sabit)" value={fmtDoviz(r.aylikTaksit||r.taksit)} accent={C.blue} big/>}
          <RRow label="Toplam Kâr Payı" value={fmtDoviz(r.toplamKarPayi)}/>
          {doviz==="TL"&&<>
            <RRow label={`BSMV (%${s.ticariBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
            <RRow label={`KKDF (%${s.ticariKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
          </>}
          {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtDoviz(r.kullUcret)} accent={C.purple} sub/>}
          <RRow label="Toplam Müşteri Maliyeti" value={fmtDoviz(r.toplamMaliyet)} accent={C.green} big/>
          {r.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
          {r.taksit&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Taksitli Ticari Finansman",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
              📅 Ödeme Planı
            </button>
            <RaporButon baslik={`Taksitli Ticari Finansman (${doviz})`} plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
              {label:"Aylık Taksit", value:fmtDoviz(r.aylikTaksit||r.taksit), big:true},
              {label:"Toplam Kâr Payı", value:fmtDoviz(r.toplamKarPayi)},
              doviz==="TL"?{label:`BSMV (%${s.ticariBSMV})`, value:fmtTL(r.bsmvTL)}:null,
              doviz==="TL"?{label:`KKDF (%${s.ticariKKDF})`, value:fmtTL(r.kkdfTL)}:null,
              r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtDoviz(r.kullUcret)}:null,
              {label:"Toplam Müşteri Maliyeti", value:fmtDoviz(r.toplamMaliyet), big:true},
              {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={r?.bsmvR||s.ticariBSMV} kkdfOran={r?.kkdfR||s.ticariKKDF}/>
          </div>}
        </Card>
      </>}
    </div>
  );
}

function KasaOranAnalizi(){
  const [mod,setMod]=useState("basilden_bilesik");
  const [gunlukOran,setGunlukOran]=useState("");
  const [vadeGun,setVadeGun]=useState("");
  const [hedefBilesik,setHedefBilesik]=useState("");

  const r=useCallback(()=>{
    const G=parseInt(vadeGun);
    if(!G)return null;

    if(mod==="basilden_bilesik"){
      const yb=parseFloat(gunlukOran);
      if(!yb)return null;
      // Günlük oran (360 baz)
      const gunlukR=yb/100/365;
      // N gün bileşik getiri: (1+gunlukR)^N - 1
      const bilesikDonem=Math.pow(1+gunlukR,G)-1;
      // Bu bileşik getiriyi yıllık basit orana çevir: getiri/N*365
      const esdeğerYillikBasil=(bilesikDonem/G)*365*100;
      // 1M ₺ için getiri
      const getiri1M=bilesikDonem*1000000;
      return{mod,yb,G,bilesikDonem:bilesikDonem*100,esdeğerYillikBasil,getiri1M};
    } else {
      const hb=parseFloat(hedefBilesik);
      if(!hb)return null;
      // Hedef yıllık basit → N günlük getiri
      const hedefDonem=hb/100/365*G;
      // Gereken günlük bileşik: (1+hedefDonem)^(1/N) - 1
      const gunlukR=Math.pow(1+hedefDonem,1/G)-1;
      // Yıllık basit eşdeğeri
      const gerekliYillikBasil=gunlukR*365*100;
      return{mod,hb,G,hedefDonem:hedefDonem*100,gerekliYillikBasil};
    }
  },[mod,gunlukOran,vadeGun,hedefBilesik])();

  return(
    <div style={{padding:"0 16px 32px"}}>

      <Card>
        <Seg options={[{v:"basilden_bilesik",l:"Basit → Eşdeğer Basit"},{v:"bilesikten_basil",l:"Hedef Basit → Gerekli"}]} value={mod} onChange={setMod}/>
        <Field label="Temdit Vade (Gün)" value={vadeGun} onChange={setVadeGun} suffix="Gün" hint="Kaç günde bir yenileniyor? (örn: 32, 91)"/>
        {mod==="basilden_bilesik"
          ? <Field label="Yıllık Basit Kâr Payı Oranı" value={gunlukOran} onChange={setGunlukOran} suffix="%" hint="Hesabın açıldığı oran (örn: 40)"/>
          : <Field label="Hedef Yıllık Basit Oran" value={hedefBilesik} onChange={setHedefBilesik} suffix="%" hint="Ulaşmak istediğin eşdeğer basit oran (örn: 40.50)"/>
        }
      </Card>

      {r&&r.mod==="basilden_bilesik"&&<Card>
        <SecTitle>Bileşik Eşdeğer Oran</SecTitle>
        <RRow label="Açılış Oranı (Yıllık Basit)" value={`% ${fmtN(r.yb,2)}`}/>
        <RRow label={`${r.G} Günlük Getiri`} value={`% ${fmtN(r.bilesikDonem,4)}`} sub accent={C.orange}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label="Bileşik Eşdeğer Yıllık Basit" value={`% ${fmtN(r.esdeğerYillikBasil,4)}`} accent={C.blue} big/>
        <div style={{background:C.blueLight,borderRadius:10,padding:"12px 14px",marginTop:10}}>
          <p style={{margin:0,fontSize:14,color:C.blue,fontWeight:800,lineHeight:1.6}}>
            %{fmtN(r.yb,2)} ile açılan hesap {r.G} gün temdit edilince
          </p>
          <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:"#1C3A5E"}}>
            ≡ %{fmtN(r.esdeğerYillikBasil,4)} yıllık basit
          </p>
          <p style={{margin:"6px 0 0",fontSize:12,color:C.sub}}>
            1.000.000 ₺ için {r.G} günlük getiri: {fmtTL(r.getiri1M)}
          </p>
        </div>
      </Card>}

      {r&&r.mod==="bilesikten_basil"&&<Card>
        <SecTitle>Gereken Açılış Oranı</SecTitle>
        <RRow label="Hedef Eşdeğer Basit Oran" value={`% ${fmtN(r.hb,2)}`}/>
        <RRow label={`${r.G} Günlük Hedef Getiri`} value={`% ${fmtN(r.hedefDonem,4)}`} sub accent={C.orange}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label="Gereken Açılış Oranı (Yıllık Basit)" value={`% ${fmtN(r.gerekliYillikBasil,4)}`} accent={C.blue} big/>
        <div style={{background:C.blueLight,borderRadius:10,padding:"12px 14px",marginTop:10}}>
          <p style={{margin:0,fontSize:14,color:C.blue,fontWeight:800,lineHeight:1.6}}>
            {r.G} günde %{fmtN(r.hb,2)} eşdeğer basit elde etmek için
          </p>
          <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:"#1C3A5E"}}>
            %{fmtN(r.gerekliYillikBasil,4)} ile açılmalı
          </p>
        </div>
      </Card>}
    </div>
  );
}


function VerimlilikAnalizi({s}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [doviz,setDoviz]=useState("TL");
  const [katilim,setKatilim]=useState("vadesiz");

  // Ayarlardan varsayılan oran: vadesiz=cari, diğerleri=katılım
  const defaultOran = katilim==="vadesiz"
    ? String(s.cariKarPayiOran||35)
    : String(s.katilimKarPayiOran||2);
  const [getiriOrani,setGetiriOrani]=useState(defaultOran);

  // Katılım dilimi değişince oranı güncelle
  useEffect(()=>{
    setGetiriOrani(katilim==="vadesiz"
      ? String(s.cariKarPayiOran||35)
      : String(s.katilimKarPayiOran||2));
  },[katilim,s.cariKarPayiOran,s.katilimKarPayiOran]);

  // TL ZK oranları (vadeye göre)
  const TL_ZK={vadesiz:17,"1ay":17,"3ay":10,"6ay":10,"1yil":10};
  // YP ZK oranları (ilave %2.5 dahil)
  const YP_ZK={vadesiz:32.5,"1ay":32.5,"3ay":28.5,"6ay":28.5,"1yil":28.5};

  // Vade gün sayıları (ZK hesabı için)
  const VADE_GUN={vadesiz:1,"1ay":31,"3ay":92,"6ay":182,"1yil":365};

  const KATILIM_OPTS=[
    {v:"vadesiz",l:"Vadesiz"},
    {v:"1ay",l:"1 Ay"},
    {v:"3ay",l:"3 Ay"},
    {v:"6ay",l:"6 Ay"},
    {v:"1yil",l:"1 Yıl"},
  ];

  const r=useCallback(()=>{
    const T=parseFloat(tutar);
    if(!T)return null;

    const zkOran=(doviz==="TL"?TL_ZK:YP_ZK)[katilim]/100;
    // Kullanılabilir tutar = Toplam × (1 - ZK oranı)
    const kullanilanTutar=Math.round(T*(1-zkOran)*100)/100;
    const zkTutar=T-kullanilanTutar;
    const vadeGun=parseInt(vade)||VADE_GUN[katilim];

    if(!getiriOrani||!vade)return{kullanilanTutar,zkTutar,zkOran:zkOran*100,T};

    const go=parseFloat(getiriOrani);
    const gunlukOran=go/100/365;

    // Getiri sadece kullanılan tutar üzerinden (ZK bloke kısım getiri sağlamaz)
    const brutFaiz=Math.round(kullanilanTutar*gunlukOran*vadeGun*100)/100;

    // Efektif yıllık getiri (toplam tutar üzerinden)
    const efektifYillik=(brutFaiz/T)/vadeGun*365*100;

    // Getiri oranının ZK etkisiyle azalması
    const efektifVsNominal=go*(1-zkOran);

    return{
      kullanilanTutar,zkTutar,zkOran:zkOran*100,T,
      brutFaiz,efektifYillik,efektifVsNominal,
      vadeGun,go,
      spread:go-s.fonlamaMaliyeti,
    };
  },[tutar,vade,getiriOrani,doviz,katilim])();

  const zkOranGoster=(doviz==="TL"?TL_ZK:YP_ZK)[katilim];
  const tutarNum=parseFloat(tutar)||0;
  const kullanilanAuto=Math.round(tutarNum*(1-zkOranGoster/100)*100)/100;

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"Türk Lirası (TL)"},{v:"YP",l:"Yabancı Para (YP)"}]} value={doviz} onChange={setDoviz}/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:6}}>Cari Katılım Dilimi</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:5,marginBottom:14}}>
          {KATILIM_OPTS.map(o=>(
            <button key={o.v} onClick={()=>setKatilim(o.v)} style={{
              padding:"8px 2px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background:katilim===o.v?C.blue:"#F0F4F8",
              color:katilim===o.v?"#fff":C.sub,
            }}>{o.l}</button>
          ))}
        </div>
        {/* ZK oranı bandı */}
        <div style={{background:C.blueLight,borderRadius:10,padding:"8px 14px",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.blue,fontWeight:600}}>ZK Oranı ({doviz})</span>
          <span style={{fontSize:14,fontWeight:800,color:C.blue}}>% {zkOranGoster}</span>
        </div>
        <Field label="Tutar" value={tutar} onChange={setTutar} suffix={doviz==="TL"?"₺":"$"}/>
        {/* ZK Dahil Tutar - otomatik, read-only */}
        {tutarNum>0&&<div style={{background:"#F0F4F8",borderRadius:10,padding:"11px 14px",marginBottom:14,border:`1.5px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:C.sub,fontWeight:600}}>Kullanılabilir Tutar (ZK Sonrası)</span>
            <span style={{fontSize:15,fontWeight:800,color:C.green}}>{fmtTL(kullanilanAuto)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
            <span style={{fontSize:11,color:C.sub}}>ZK Bloke Tutarı</span>
            <span style={{fontSize:13,fontWeight:700,color:C.red}}>{fmtTL(tutarNum-kullanilanAuto)}</span>
          </div>
        </div>}
        <Field label="Vade (Gün)" value={vade} onChange={setVade} suffix="Gün" hint={`Seçilen dilim: ${VADE_GUN[katilim]} gün`}/>
        <Field label="Kâr Payı Oranı (Yıllık)" value={getiriOrani} onChange={setGetiriOrani} suffix="%"/>
      </Card>

      {r&&r.brutFaiz!==undefined&&<Card>
        <SecTitle>Verimlilik Analizi</SecTitle>
        <RRow label="Toplam Tutar" value={fmtTL(r.T)}/>
        <RRow label={`ZK Bloke (%${fmtN(r.zkOran)})`} value={`- ${fmtTL(r.zkTutar)}`} sub accent={C.red}/>
        <RRow label="Kullanılabilir Tutar" value={fmtTL(r.kullanilanTutar)} accent={C.blue}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label={`Gelir (${r.vadeGun} Gün)`} value={fmtTL(r.brutFaiz)} accent={C.orange} big/>

      </Card>}
    </div>
  );
}



// ─── ESNEK ÖDEME PLANLARI ────────────────────────────────────────────────────
const BSMV_ORAN = 5; // %5 sabit

function GecmisKaydetButon({onGecmis, kayit}:any){
  const [kaydedildi,setKaydedildi]=useState(false);
  if(!onGecmis) return null;
  return(
    <button onClick={()=>{onGecmis(kayit);setKaydedildi(true);setTimeout(()=>setKaydedildi(false),2000);}}
      style={{width:"100%",marginBottom:6,padding:"10px",borderRadius:12,
        border:`1.5px solid ${kaydedildi?"#1A5C4A":"#2A7A72"}`,
        background:kaydedildi?"#EBF5F0":"#E8F5F4",
        color:kaydedildi?"#1A5C4A":"#2A7A72",
        fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
      {kaydedildi?"✅ Kaydedildi":"🕐 Geçmişe Kaydet"}
    </button>
  );
}

function OdemePlanTablosu({plan, showKomisyon=false}){
  const fmt=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const totTaksit=plan.reduce((s,r)=>s+(r.taksit||0),0);
  const totKP=plan.reduce((s,r)=>s+(r.karPayi||0),0);
  const totAna=plan.reduce((s,r)=>s+(r.anapara||0),0);
  const totBsmv=plan.reduce((s,r)=>s+(r.bsmv||0),0);
  return(
    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginTop:8}}>
      <div style={{minWidth:480}}>
        <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"6px 4px"}}>
          {["#","Tarih","Taksit","Anapara","Kâr Payı","BSMV","Kalan"].map((h,i)=>(
            <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>1?"right":"center",padding:"0 2px"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:300,overflowY:"auto"}}>
          {plan.map((r,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:i%2===0?"#F8FAFB":"#fff",borderBottom:"1px solid #F0F0F0"}}>
              <span style={{fontSize:9,color:"#6B7280",textAlign:"center",fontWeight:600}}>{r.ay}</span>
              <span style={{fontSize:9,color:"#6B7280",textAlign:"center"}}>{r.tarih||""}</span>
              {[r.taksit,r.anapara,r.karPayi,r.bsmv,r.bakiye].map((v,vi)=>(
                <span key={vi} style={{fontSize:9,color:"#1a1a1a",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{fmt(v)}</span>
              ))}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:"#1C3A5E"}}>
          <span style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"center"}}>∑</span>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>—</span>
          {[totTaksit,totAna,totKP,totBsmv,"—"].map((v,vi)=>(
            <span key={vi} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{typeof v==="number"?fmt(v):v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EsnekOdemePlanlari({nav}){
  const planlar=[
    {key:"esitAnapara",   icon:"📊", baslik:"Eşit Anapara Ödeme Planı",  aciklama:"Her ay eşit anapara, azalan taksit"},
    {key:"araOdemeli",    icon:"💡", baslik:"Ara Ödemeli Plan",           aciklama:"Belirli aylarda ekstra anapara ödemesi"},
    {key:"artanOdemeli",  icon:"📈", baslik:"Artan Ödemeli Plan",         aciklama:"Her dönem artan taksit ödemesi"},
    {key:"azalanOdemeli", icon:"📉", baslik:"Azalan Ödemeli Plan",        aciklama:"Her dönem azalan taksit ödemesi"},
    {key:"balonOdemeli",  icon:"🎈", baslik:"Balon Ödemeli Plan",         aciklama:"Vadede büyük son ödeme (balon)"},
    {key:"esnekOdemeli",  icon:"🔧", baslik:"Esnek Ödemeli Plan",         aciklama:"Her ay farklı anapara girişi"},
  ];
  return(
    <div style={{padding:"0 16px 32px"}}>
      <div style={{background:"#EBF3FB",borderRadius:12,padding:"10px 14px",marginBottom:14,border:"1px solid #2C5F8A22"}}>
        <p style={{margin:0,fontSize:12,color:"#2C5F8A",fontWeight:600}}>BSMV: %5 · KKDF: %0 · Tüm planlarda uygulanır</p>
      </div>
      {planlar.map((p,i)=>(
        <div key={i} onClick={()=>nav(p.key)} style={{display:"flex",alignItems:"center",gap:14,background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:9,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
          <div style={{width:46,height:46,borderRadius:12,background:"#EBF3FB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{p.icon}</div>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:15,fontWeight:700,color:"#1C2B3A"}}>{p.baslik}</p>
            <p style={{margin:"2px 0 0",fontSize:12,color:"#6B7B8D"}}>{p.aciklama}</p>
          </div>
          <span style={{color:"#B8C4CE",fontSize:20}}>›</span>
        </div>
      ))}
    </div>
  );
}

function EsitAnapara({onGecmis}:any){
  const [doviz,setDoviz]=useState("TL");
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;

  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){
      const V=parseInt(vade)||0;
      if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}
    }
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100);
    if(!T||!V||!ao) return null;
    const esitAna=Math.round(T/V*100)/100;
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=i<V?esitAna:Math.round(bakiye*100)/100;
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    // Efektif yıllık
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0&&rows[0]?.taksit>0){
      let lo=0.0001/12,hi=3/12;
      const taksit1=rows[0].taksit;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"#F0F4F8",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="İlk Taksit" value={`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`}/>
          <RRow label="Son Taksit" value={`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`}/>
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Eşit Anapara Ödeme Planı",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Eşit Anapara Ödeme Planı" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          ...(plan.kullUcret>0?[{label:`Kullandırım Kom. (%${fmtN(plan.kullOUyg,4)})`, value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"İlk Taksit", value:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`, big:true},
          {label:"Son Taksit", value:`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`},
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,taksit:r.taksit,anapara:r.anapara,karPayi:r.karPayi,bakiye:r.bakiye}))}/>
      </>}
    </div>
  );
}

function AraOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [oranTip,setOranTip]=useState("aylik"); // aylik | yillik
  const [ilkAraAy,setIlkAraAy]=useState("");
  const [araSiklik,setAraSiklik]=useState("");
  const [araTutar,setAraTutar]=useState("");
  const [araYontem,setAraYontem]=useState("sadece");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  const araAylar=useMemo(()=>{
    const ilk=parseInt(ilkAraAy)||0;
    const siklik=parseInt(araSiklik)||0;
    const V=parseInt(vade)||0;
    if(!ilk||!V) return [];
    const aylar=[];
    for(let ay=ilk;ay<=V;ay+=siklik||V){
      aylar.push(ay);
      if(!siklik) break;
    }
    return aylar;
  },[ilkAraAy,araSiklik,vade]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran),AT=parseFloat(araTutar)||0;
    if(!T||!V||!rt) return null;
    const ao=oranTip==="yillik"?rt/100/12:rt/100;
    const now=new Date();

    // Bisection: her ara ödeme tam AT, normal taksit sabit, plan sonu bakiye=0
    const simule=(pmt:number)=>{
      let b=T;
      for(let i=1;i<=V;i++){
        const kp=Math.round(b*ao*100)/100;
        const bsmv=Math.round(kp*BSMV_ORAN/100*100)/100;
        if(araAylar.includes(i)&&AT>0){
          // Ara ödeme: her zaman tam AT (anapara = AT - kp - bsmv)
          const ana=Math.round((AT-kp-bsmv)*100)/100;
          b=Math.round((b-ana)*100)/100;
        } else {
          if(b<=0) break;
          const ana=Math.min(Math.max(0,Math.round((pmt-kp)*100)/100),b);
          b=Math.max(0,Math.round((b-ana)*100)/100);
        }
      }
      return b;
    };

    let lo=0.01, hi=T;
    for(let i=0;i<300;i++){
      const mid=(lo+hi)/2;
      if(simule(mid)>0) lo=mid; else hi=mid;
    }
    const pmt=(lo+hi)/2;

    // Planı oluştur
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      if(bakiye<=0&&!araAylar.includes(i)) break;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*BSMV_ORAN/100*100)/100;
      const isAraAy=araAylar.includes(i)&&AT>0;
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      const tarihStr=MONTHS[d.getMonth()]+" "+d.getFullYear();

      if(isAraAy){
        // Tam AT ödenir
        const anapara=Math.round((AT-kp-bsmv)*100)/100;
        bakiye=Math.round((bakiye-anapara)*100)/100;
        rows.push({ay:i,tarih:tarihStr,taksit:AT,anapara,kp,bsmv,bakiye:Math.max(0,bakiye),isAra:true});
        bakiye=Math.max(0,bakiye);
      } else {
        const sonAy=bakiye<=pmt-kp+0.01;
        const anapara=sonAy?Math.round(bakiye*100)/100:Math.min(Math.max(0,Math.round((pmt-kp)*100)/100),bakiye);
        const taksit=Math.round((anapara+kp+bsmv)*100)/100;
        bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
        rows.push({ay:i,tarih:tarihStr,taksit,anapara,kp,bsmv,bakiye,isAra:false});
      }
      if(bakiye<=0&&i===V) break;
    }
    return rows;
  },[tutar,vade,oran,oranTip,araAylar,araTutar,araYontem]);

  const normalRows=plan?.filter(r=>!r.isAra)||[];
  const toplamTaksit=plan?.reduce((s,r)=>s+r.taksit,0)||0;
  const toplamKP=plan?.reduce((s,r)=>s+r.kp,0)||0;
  const toplamBsmv=plan?.reduce((s,r)=>s+r.bsmv,0)||0;

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <div style={{marginBottom:13}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={{fontSize:12,fontWeight:600,color:C.sub}}>Kâr Payı Oranı</label>
            <div style={{display:"flex",background:"#E5E5EA",borderRadius:8,padding:2}}>
              {[{v:"aylik",l:"Aylık"},{v:"yillik",l:"Yıllık"}].map(o=>(
                <button key={o.v} onClick={()=>setOranTip(o.v)} style={{padding:"3px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:oranTip===o.v?C.blue:"transparent",color:oranTip===o.v?"#fff":C.sub}}>{o.l}</button>
              ))}
            </div>
          </div>
          <Field label="" value={oran} onChange={setOran} suffix="%"/>
        </div>
        <div style={{height:1,background:C.border,margin:"4px 0 14px"}}/>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.blue}}>Ara Ödeme Planı</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:13}}>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>İlk Ara Ödeme</label>
            <div style={{position:"relative"}}>
              <input inputMode="numeric" value={ilkAraAy} onChange={e=>setIlkAraAy(e.target.value.replace(/[^0-9]/g,""))}
                placeholder="0"
                style={{width:"100%",boxSizing:"border-box",padding:"11px 52px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
              <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:10,color:C.sub,fontWeight:600}}>Taksit No</span>
            </div>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Ara Ödeme Sıklığı</label>
            <div style={{position:"relative"}}>
              <input inputMode="numeric" value={araSiklik} onChange={e=>setAraSiklik(e.target.value.replace(/[^0-9]/g,""))}
                placeholder="0"
                style={{width:"100%",boxSizing:"border-box",padding:"11px 36px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
              <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:C.sub,fontWeight:600}}>Ay</span>
            </div>
          </div>
        </div>
        {araAylar.length>0&&<div style={{background:C.blueLight,borderRadius:8,padding:"7px 12px",marginBottom:12}}>
          <p style={{margin:0,fontSize:11,color:C.blue,fontWeight:600}}>Ara ödeme ayları: {araAylar.join(", ")}</p>
        </div>}
        <Field label="Ara Ödeme Tutarı (Toplam Taksit)" value={araTutar} onChange={setAraTutar} suffix="₺" hint="Bu tutar toplam taksit tutarıdır (kâr payı + BSMV dahil)"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:8}}>Ara Ödeme Yöntemi</label>
        {[
          {v:"sadece",l:"Ara Ödeme Tutarını Öde",a:"O ay sadece ara ödeme yapılır"},
          {v:"ekle",l:"Taksite Eklensin",a:"Normal taksit + ara ödeme aynı ayda"},
        ].map(o=>(
          <div key={o.v} onClick={()=>setAraYontem(o.v)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:12,border:`2px solid ${araYontem===o.v?C.blue:C.border}`,background:araYontem===o.v?C.blueLight:"#fff",marginBottom:8,cursor:"pointer"}}>
            <div style={{width:20,height:20,borderRadius:10,border:`2px solid ${araYontem===o.v?C.blue:C.border}`,background:araYontem===o.v?C.blue:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {araYontem===o.v&&<div style={{width:8,height:8,borderRadius:4,background:"#fff"}}/>}
            </div>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:araYontem===o.v?C.blue:C.label}}>{o.l}</p>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.sub}}>{o.a}</p>
            </div>
          </div>
        ))}
      </Card>
      {plan&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`₺${fmt2(parseFloat(tutar))}`}/>
          <RRow label="Normal Taksit Tutarı" value={`₺${fmt2(normalRows[0]?.taksit)}`}/>
          <RRow label={`Ara Ödeme (${araAylar.length} kez)`} value={`₺${fmt2(parseFloat(araTutar||"0"))} × ${araAylar.length}`} accent={C.orange}/>
          <RRow label="Toplam Geri Ödeme" value={`₺${fmt2(toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`₺${fmt2(toplamKP)}`} accent={C.orange}/>
          <RRow label="Toplam BSMV (%5)" value={`₺${fmt2(toplamBsmv)}`} sub/>
        </Card>
        <Card>
          <SecTitle>Ödeme Planı</SecTitle>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginTop:8}}>
            <div style={{minWidth:480}}>
              <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"6px 4px"}}>
                {["#","Tarih","Taksit","Anapara","Kâr Payı","BSMV","Kalan"].map((h,i)=>(
                  <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>1?"right":"center",padding:"0 2px"}}>{h}</span>
                ))}
              </div>
              <div style={{maxHeight:350,overflowY:"auto"}}>
                {plan.map((r,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:r.isAra?"#FFF8E7":i%2===0?"#F8FAFB":"#fff",borderBottom:`1px solid ${r.isAra?"#FFD700":"#F0F0F0"}`,borderLeft:r.isAra?"3px solid #FFB800":"none"}}>
                    <span style={{fontSize:9,color:r.isAra?"#B8860B":"#6B7280",textAlign:"center",fontWeight:700}}>{r.ay}</span>
                    <span style={{fontSize:9,color:r.isAra?"#B8860B":"#6B7280",textAlign:"center"}}>{r.tarih}</span>
                    {[r.taksit,r.anapara,r.kp,r.bsmv,r.bakiye].map((v,vi)=>(
                      <span key={vi} style={{fontSize:9,color:r.isAra?"#B8860B":"#1a1a1a",textAlign:"right",fontFamily:"monospace",padding:"0 2px",fontWeight:r.isAra?700:400}}>{v!=null?fmt2(v):"—"}</span>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:"#1C3A5E"}}>
                <span style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"center"}}>∑</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>—</span>
                {[toplamTaksit,plan.reduce((s,r)=>s+r.anapara,0),toplamKP,toplamBsmv,"—"].map((v,vi)=>(
                  <span key={vi} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{typeof v==="number"?fmt2(v):v}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Ara Ödemeli Plan",tutar:`₺${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`₺${fmt2(toplamTaksit)}`,netGetiri:`₺${fmt2(toplamKP)}`,aylikTaksit:"—",plan:[]}}/>
        <RaporButon baslik="Ara Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`₺${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Ara Ödeme Ayları", value:araAylar.join(", ")||"—"},
          {label:"Ara Ödeme Tutarı", value:`₺${fmt2(parseFloat(araTutar))}`},
          {label:"Toplam Kâr Payı", value:`₺${fmt2(toplamKP)}`},
          {label:"Toplam BSMV", value:`₺${fmt2(toplamBsmv)}`},
          {label:"Toplam Ödeme", value:`₺${fmt2(toplamTaksit)}`, big:true},
        ]} plan={plan.map(r=>({...r,karPayi:r.kp}))}/>
      </>}
    </div>
  );
}

function ArtanOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [artisOran,setArtisOran]=useState("");

  const [doviz,setDoviz]=useState("TL");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;
  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){const V=parseInt(vade)||0;if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}}
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100),ar=parseFloat(artisOran)/100||0;
    if(!T||!V||!ao) return null;
    let pmt0=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    if(ar>0){let pv=0;for(let i=1;i<=V;i++)pv+=pmt0*Math.pow(1+ar,i-1)/Math.pow(1+ao,i);pmt0=pmt0*(T/pv);}
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const taksitNet=Math.round(pmt0*Math.pow(1+ar,i-1)*100)/100;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=Math.min(Math.round((taksitNet-kp)*100)/100,bakiye);
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0){
      let lo=0.0001/12,hi=3/12;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,artisOran,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <Field label="Aylık Artış Oranı" value={artisOran} onChange={setArtisOran} suffix="%" hint="Her ay taksit bu oranda artar"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"#F0F4F8",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="İlk Taksit" value={`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`}/>
          <RRow label="Son Taksit" value={`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`}/>
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Artan Ödemeli Plan",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Artan Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          ...(plan.kullUcret>0?[{label:`Kullandırım Kom.`, value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"İlk Taksit", value:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`},
          {label:"Son Taksit", value:`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`},
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,karPayi:r.karPayi}))}/>
      </>}
    </div>
  );
}

function AzalanOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [azalisOran,setAzalisOran]=useState("");

  const [doviz,setDoviz]=useState("TL");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;
  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){const V=parseInt(vade)||0;if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}}
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100),az2=parseFloat(azalisOran)/100||0;
    if(!T||!V||!ao) return null;
    let pmt0=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    if(az2>0){let pv=0;for(let i=1;i<=V;i++)pv+=pmt0*Math.pow(1-az2,i-1)/Math.pow(1+ao,i);pmt0=pmt0*(T/pv);}
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const taksitNet=Math.round(pmt0*Math.pow(1-az2,i-1)*100)/100;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=Math.min(Math.max(0,Math.round((taksitNet-kp)*100)/100),bakiye);
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0){
      let lo=0.0001/12,hi=3/12;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,azalisOran,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <Field label="Aylık Azalış Oranı" value={azalisOran} onChange={setAzalisOran} suffix="%" hint="Her ay taksit bu oranda azalır"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"#F0F4F8",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="İlk Taksit" value={`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`}/>
          <RRow label="Son Taksit" value={`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`}/>
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Azalan Ödemeli Plan",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Azalan Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          ...(plan.kullUcret>0?[{label:`Kullandırım Kom.`, value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"İlk Taksit", value:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`},
          {label:"Son Taksit", value:`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`},
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,karPayi:r.karPayi}))}/>
      </>}
    </div>
  );
}

function BalonOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [balonTutar,setBalonTutar]=useState("");

  const [doviz,setDoviz]=useState("TL");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;
  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){const V=parseInt(vade)||0;if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}}
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100),B=parseFloat(balonTutar)||0;
    if(!T||!V||!ao) return null;
    const T_ara=T-B/Math.pow(1+ao,V);
    const pmt=ao===0?T_ara/V:T_ara*ao/(1-Math.pow(1+ao,-V));
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=i<V?Math.min(Math.round((pmt-kp)*100)/100,bakiye):Math.round(bakiye*100)/100;
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0){
      let lo=0.0001/12,hi=3/12;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,balonTutar,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <Field label="Balon Ödeme Tutarı" value={balonTutar} onChange={setBalonTutar} suffix={dovizSembol} hint="Son ayda ödenecek büyük tutar"/>

        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"#FEF2F2",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"#F0F4F8",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Balon Ödemeli Plan",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Balon Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          {label:"Balon Ödeme", value:`${dovizSembol}${fmt2(parseFloat(balonTutar))}`},
          ...(plan.kullUcret>0?[{label:"Kullandırım Kom.", value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,karPayi:r.karPayi}))}/>
      </>}
    </div>
  );
}

function EsnekOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [oranTip,setOranTip]=useState("aylik");
  const [sabitTutar,setSabitTutar]=useState<{[k:number]:string}>({});
  const [odemeYapma,setOdemeYapma]=useState<{[k:number]:boolean}>({});
  const [araOdeme,setAraOdeme]=useState<{[k:number]:string}>({});
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n:any)=>n==null||isNaN(n)?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  const V=parseInt(vade)||0;
  const T=parseFloat(tutar)||0;
  const ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100)||0;

  const plan=useMemo(()=>{
    if(!T||!V||!ao) return null;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const now=new Date();
    let bakiye=T; const rows=[];

    for(let i=1;i<=V;i++){
      if(bakiye<=0) break;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*BSMV_ORAN/100*100)/100;
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      const tarihStr=MONTHS[d.getMonth()]+" "+d.getFullYear();
      const atla=odemeYapma[i]||false;
      const sabit=parseFloat(sabitTutar[i]||"")||0;
      const ekstra=parseFloat(araOdeme[i]||"")||0;
      const sonAy=i===V;

      if(atla){
        // Ödeme yapılmıyor — kâr payı bakiyeye eklenir
        const yeniBakiye=Math.round((bakiye+kp)*100)/100;
        rows.push({ay:i,tarih:tarihStr,taksit:0,anapara:0,kp,bsmv:0,bakiye:yeniBakiye,atla:true,sabit:0,ekstra:0});
        bakiye=yeniBakiye;
      } else {
        // Sabit tutar varsa onu kullan, yoksa standart PMT
        const hedefTaksit=sabit>0?sabit:pmt+bsmv;
        // hedefTaksit = anapara + kp + bsmv → anapara = hedefTaksit - kp - bsmv
        const anaFromHedef=Math.max(0,Math.round((hedefTaksit-kp-bsmv)*100)/100);
        let anapara=sonAy?Math.round(bakiye*100)/100:Math.min(anaFromHedef,bakiye);
        // Ekstra ara ödeme ekle
        if(ekstra>0) anapara=Math.min(Math.round((anapara+ekstra)*100)/100,bakiye);
        const taksit=Math.round((anapara+kp+bsmv)*100)/100;
        bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
        rows.push({ay:i,tarih:tarihStr,taksit,anapara,kp,bsmv,bakiye,atla:false,sabit,ekstra});
      }
      if(bakiye<=0) break;
    }
    return rows;
  },[T,V,ao,sabitTutar,odemeYapma,araOdeme]);

  const stdTaksit=T&&V&&ao?Math.round((ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V))+(T*ao*BSMV_ORAN/100))*100)/100:0;
  const toplamTaksit=plan?.reduce((s,r)=>s+r.taksit,0)||0;
  const toplamKP=plan?.reduce((s,r)=>s+r.kp,0)||0;
  const toplamBsmv=plan?.reduce((s,r)=>s+r.bsmv,0)||0;

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <label style={{fontSize:12,fontWeight:600,color:C.sub}}>Kâr Payı Oranı</label>
          <div style={{display:"flex",background:"#E5E5EA",borderRadius:8,padding:2}}>
            {[{v:"aylik",l:"Aylık"},{v:"yillik",l:"Yıllık"}].map(o=>(
              <button key={o.v} onClick={()=>setOranTip(o.v)} style={{padding:"3px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:oranTip===o.v?C.blue:"transparent",color:oranTip===o.v?"#fff":C.sub}}>{o.l}</button>
            ))}
          </div>
        </div>
        <Field label="" value={oran} onChange={setOran} suffix="%"/>
        {stdTaksit>0&&<div style={{background:C.blueLight,borderRadius:10,padding:"8px 12px"}}>
          <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:600}}>Standart Taksit: <span style={{fontFamily:"monospace",fontWeight:800}}>₺{fmt2(stdTaksit)}</span></p>
        </div>}
      </Card>

      {plan&&plan.length>0&&(
        <Card style={{padding:"10px 8px"}}>
          <SecTitle>Aylık Özelleştirme</SecTitle>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{minWidth:500}}>
              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:"26px 50px 90px 60px 80px 90px",background:"#1C3A5E",padding:"6px 4px",borderRadius:"6px 6px 0 0"}}>
                {["Ay","Tarih","Sabit Tutar","Ödeme Yapma","Ara Ödeme","Hesap. Taksit"].map((h,i)=>(
                  <span key={i} style={{fontSize:8,fontWeight:800,color:"#fff",textAlign:"center",padding:"0 2px",whiteSpace:"pre-line",lineHeight:1.3}}>{h}</span>
                ))}
              </div>
              {/* Rows */}
              {Array.from({length:V},(_,idx)=>idx+1).map(ay=>{
                const r=plan.find(r=>r.ay===ay);
                const atla=odemeYapma[ay]||false;
                return(
                  <div key={ay} style={{display:"grid",gridTemplateColumns:"26px 50px 90px 60px 80px 90px",padding:"4px",
                    background:atla?"#FFF0F0":r?.ekstra>0?"#FFF8E7":r?.sabit>0?"#F0F8FF":ay%2===0?"#F8FAFB":"#fff",
                    borderBottom:"1px solid #F0F0F0",
                    borderLeft:atla?"3px solid #FF3B30":r?.ekstra>0?"3px solid #FFB800":r?.sabit>0?"3px solid #2C5F8A":"none"}}>
                    <span style={{fontSize:10,color:atla?"#FF3B30":C.sub,textAlign:"center",fontWeight:700,alignSelf:"center"}}>{ay}</span>
                    <span style={{fontSize:9,color:C.sub,textAlign:"center",alignSelf:"center"}}>{MONTHS[(new Date().getMonth()+ay)%12]}</span>
                    {/* Sabit Tutar */}
                    <div style={{padding:"0 2px"}}>
                      <input inputMode="decimal" value={sabitTutar[ay]||""} disabled={atla}
                        onChange={e=>setSabitTutar(p=>({...p,[ay]:e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,"")}))}
                        placeholder="Opsiyonel"
                        style={{width:"100%",boxSizing:"border-box",padding:"4px 6px",fontSize:10,fontFamily:"monospace",
                          background:atla?"#F0F0F0":"#F9F9FB",border:`1px solid ${C.border}`,borderRadius:5,
                          color:"#1C1C1E",outline:"none",textAlign:"right"}}/>
                    </div>
                    {/* Toggle */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div onClick={()=>setOdemeYapma(p=>({...p,[ay]:!p[ay]}))} style={{
                        width:36,height:20,borderRadius:10,
                        background:atla?"#FF3B30":"#34C759",
                        cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0
                      }}>
                        <div style={{
                          position:"absolute",top:2,left:atla?2:16,width:16,height:16,
                          borderRadius:8,background:"#fff",transition:"left 0.2s",
                          boxShadow:"0 1px 2px rgba(0,0,0,0.3)"
                        }}/>
                      </div>
                    </div>
                    {/* Ara Ödeme */}
                    <div style={{padding:"0 2px"}}>
                      <input inputMode="decimal" value={araOdeme[ay]||""} disabled={atla}
                        onChange={e=>setAraOdeme(p=>({...p,[ay]:e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,"")}))}
                        placeholder="Ekstra"
                        style={{width:"100%",boxSizing:"border-box",padding:"4px 6px",fontSize:10,fontFamily:"monospace",
                          background:atla?"#F0F0F0":"#F9F9FB",border:`1px solid ${C.border}`,borderRadius:5,
                          color:"#1C1C1E",outline:"none",textAlign:"right"}}/>
                    </div>
                    {/* Hesaplanan Taksit */}
                    <span style={{fontSize:10,fontWeight:700,color:atla?"#FF3B30":C.blue,fontFamily:"monospace",textAlign:"right",alignSelf:"center",padding:"0 4px"}}>
                      {atla?"—":r?`₺${fmt2(r.taksit)}`:`₺${fmt2(stdTaksit)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {plan&&plan.length>0&&onGecmis&&<GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Esnek Ödemeli Plan",tutar:`₺${fmt2(T)}`,vade:V+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`₺${fmt2(plan.reduce((s,r)=>s+r.taksit,0))}`,netGetiri:`₺${fmt2(plan.reduce((s,r)=>s+r.kp,0))}`,aylikTaksit:`₺${fmt2(stdTaksit)}`,plan:[]}}/>}
      {plan&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`₺${fmt2(T)}`}/>
          <RRow label="Standart Taksit" value={`₺${fmt2(stdTaksit)}`}/>
          <RRow label="Toplam Geri Ödeme" value={`₺${fmt2(toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`₺${fmt2(toplamKP)}`} accent={C.orange}/>
          <RRow label="Toplam BSMV (%5)" value={`₺${fmt2(toplamBsmv)}`} sub/>
          {Object.values(odemeYapma).some(v=>v)&&<RRow label="Atlanan Ay" value={`${Object.values(odemeYapma).filter(v=>v).length} ay`} accent={C.red} sub/>}
        </Card>
        <Card>
          <SecTitle>Ödeme Planı</SecTitle>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginTop:8}}>
            <div style={{minWidth:480}}>
              <div style={{display:"grid",gridTemplateColumns:"24px 55px 1fr 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"6px 4px"}}>
                {["#","Tarih","Taksit","Anapara","Kâr Payı","BSMV","Kalan"].map((h,i)=>(
                  <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>1?"right":"center",padding:"0 2px"}}>{h}</span>
                ))}
              </div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {plan.map((r,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"24px 55px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",
                    background:r.atla?"#FFF0F0":r.ekstra>0?"#FFF8E7":r.sabit>0?"#F0F8FF":i%2===0?"#F8FAFB":"#fff",
                    borderBottom:"1px solid #F0F0F0",
                    borderLeft:r.atla?"3px solid #FF3B30":r.ekstra>0?"3px solid #FFB800":r.sabit>0?"3px solid #2C5F8A":"none"}}>
                    <span style={{fontSize:9,color:r.atla?"#FF3B30":"#6B7280",textAlign:"center",fontWeight:700}}>{r.ay}</span>
                    <span style={{fontSize:9,color:"#6B7280",textAlign:"center"}}>{r.tarih}</span>
                    {[r.taksit,r.anapara,r.kp,r.bsmv,r.bakiye].map((v,vi)=>(
                      <span key={vi} style={{fontSize:9,color:r.atla?"#FF3B30":"#1a1a1a",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>
                        {r.atla&&vi===0?"ATLA":fmt2(v)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"24px 55px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:"#1C3A5E"}}>
                <span style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"center"}}>∑</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>—</span>
                {[toplamTaksit,plan.reduce((s,r)=>s+r.anapara,0),toplamKP,toplamBsmv,"—"].map((v,vi)=>(
                  <span key={vi} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{typeof v==="number"?fmt2(v):v}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </>}
    </div>
  );
}

// ─── FİNANSAL TAKVİM ────────────────────────────────────────────────────────
function FinansalTakvim(){
  const [filtre,setFiltre]=useState("tumu");
  const bugun=new Date(); bugun.setHours(0,0,0,0);

  // ZK tarihleri: 19 Haz 2026 başlangıç, 2 haftada bir Cuma
  const zkTarihleri=[];
  const zkStart=new Date(2026,5,19); // 19 Haziran 2026
  for(let i=0;i<40;i++){
    const t=new Date(zkStart);
    t.setDate(zkStart.getDate()+i*14);
    if(t.getFullYear()>2027) break;
    zkTarihleri.push(t);
  }

  // PPK tarihleri 2026 (TCMB resmi)
  const PPK_2026=[
    new Date(2026,0,22),new Date(2026,2,12),new Date(2026,3,22),
    new Date(2026,5,11),new Date(2026,6,23),new Date(2026,8,10),
    new Date(2026,9,22),new Date(2026,11,10),
  ];

  // TL Payı Rasyo: 03/07/2026 başlangıç, 8 haftada bir Cuma
  const tlPayiTarihleri=[];
  const tlStart=new Date(2026,6,3); // 3 Temmuz 2026
  for(let i=0;i<20;i++){
    const t=new Date(tlStart);
    t.setDate(tlStart.getDate()+i*56); // 8 hafta = 56 gün
    if(t.getFullYear()>2027) break;
    tlPayiTarihleri.push(t);
  }

  // Kredi Büyüme tarihleri: 17/07/2026 başlangıç, 8 haftada bir Cuma
  const krediTarihleri=[];
  const krediStart=new Date(2026,6,17); // 17 Temmuz 2026
  for(let i=0;i<20;i++){
    const t=new Date(krediStart);
    t.setDate(krediStart.getDate()+i*56); // 8 hafta = 56 gün
    if(t.getFullYear()>2027) break;
    krediTarihleri.push(t);
  }

  const tumEvents=[
    ...PPK_2026.map(t=>({tarih:t,tip:"ppk",label:"PPK Toplantısı",renk:"#9C3060",bg:"#FCE4EC",icon:"🏛️"})),
    ...zkTarihleri.map(t=>({tarih:t,tip:"zk",label:"ZK Hesaplama",renk:C.blue,bg:C.blueLight,icon:"📊"})),
    ...tlPayiTarihleri.map(t=>({tarih:t,tip:"tlpayi",label:"TL Payı Rasyo Hesaplama",renk:C.green,bg:C.greenLight,icon:"📈"})),
    ...krediTarihleri.map(t=>({tarih:t,tip:"kredi",label:"Kredi Büyüme Hesaplama",renk:C.orange,bg:C.orangeLight,icon:"💳"})),
  ]
  .filter(e=>e.tarih>=bugun)
  .sort((a,b)=>a.tarih-b.tarih);

  const filtreliEvents=filtre==="tumu"?tumEvents:tumEvents.filter(e=>e.tip===filtre);

  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const DAYS=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const formatTarih=(d)=>`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${DAYS[d.getDay()]}`;
  const kalanGun=(d)=>{
    const diff=Math.round((d-bugun)/(1000*60*60*24));
    if(diff===0)return{text:"Bugün",renk:"#B83232"};
    if(diff===1)return{text:"Yarın",renk:C.orange};
    if(diff<=7)return{text:`${diff} gün`,renk:C.orange};
    return{text:`${diff} gün`,renk:C.sub};
  };

  const FILTRELER=[
    {v:"tumu",l:"Tümü",renk:"#1C3A5E"},
    {v:"ppk",l:"PPK",renk:"#9C3060",icon:"🏛️"},
    {v:"zk",l:"ZK",renk:C.blue,icon:"📊"},
    {v:"tlpayi",l:"TL Payı",renk:C.green,icon:"📈"},
    {v:"kredi",l:"Kredi Büyüme",renk:C.orange,icon:"💳"},
  ];

  const yaklasan=tumEvents.filter(e=>Math.round((e.tarih-bugun)/(1000*60*60*24))<=7).length;

  return(
    <div style={{padding:"0 16px 32px"}}>
      {yaklasan>0&&<div style={{background:"#FEF3C7",borderRadius:12,padding:"10px 14px",marginBottom:14,border:"1px solid #F59E0B",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>⚠️</span>
        <p style={{margin:0,fontSize:13,color:"#92400E",fontWeight:700}}>Önümüzdeki 7 günde {yaklasan} önemli tarih var</p>
      </div>}
      <div style={{display:"flex",gap:8,marginBottom:18,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
        {FILTRELER.map(f=>(
          <button key={f.v} onClick={()=>setFiltre(f.v)} style={{
            padding:"11px 18px",borderRadius:24,border:"none",cursor:"pointer",
            fontWeight:700,fontSize:14,whiteSpace:"nowrap",flexShrink:0,
            background:filtre===f.v?f.renk:"#F0F4F8",
            color:filtre===f.v?"#fff":C.sub,
            boxShadow:filtre===f.v?"0 3px 10px rgba(0,0,0,0.15)":"none",
          }}>{f.icon?f.icon+" ":""}{f.l}</button>
        ))}
      </div>
      {filtreliEvents.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.sub}}>
        <p style={{fontSize:36,margin:"0 0 8px"}}>📅</p>
        <p style={{fontSize:14,fontWeight:600}}>Bu kategoride yaklaşan tarih yok</p>
      </div>}
      {filtreliEvents.map((e,i)=>{
        const kg=kalanGun(e.tarih);
        const oncekiAy=i===0?-1:filtreliEvents[i-1].tarih.getMonth();
        const yeniAy=oncekiAy!==e.tarih.getMonth();
        return(
          <div key={i}>
            {yeniAy&&<p style={{fontSize:12,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",margin:"16px 0 8px"}}>{MONTHS[e.tarih.getMonth()]} {e.tarih.getFullYear()}</p>}
            <div style={{display:"flex",alignItems:"center",gap:12,background:C.card,borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",borderLeft:`4px solid ${e.renk}`}}>
              <div style={{width:40,height:40,borderRadius:10,background:e.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {e.icon}
              </div>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"#1C1C1E"}}>{e.label}</p>
                <p style={{margin:"2px 0 0",fontSize:12,color:C.sub}}>{formatTarih(e.tarih)}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:kg.renk}}>{kg.text}</p>
                <p style={{margin:"1px 0 0",fontSize:10,color:C.sub}}>kaldı</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ─── TM KOMİSYON ─────────────────────────────────────────────────────────────
function TmKomisyon(){
  const [tutar,setTutar]=useState("");
  const [oran,setOran]=useState("");
  const [vade,setVade]=useState("");
  const [odeme,setOdeme]=useState("aylik");

  const r=useCallback(()=>{
    const T=parseFloat(tutar),rt=parseFloat(oran),G=parseInt(vade);
    if(!T||!rt||!G)return null;
    // Yıllık oran üzerinden gün bazlı hesap (360)
    const gunlukOran=rt/100/365;
    const toplamKomisyon=Math.round(T*gunlukOran*G*100)/100;

    let plan=[];
    if(odeme==="aylik"){
      // Aylık: her 30 günde bir eşit taksit
      const aylik=Math.ceil(G/30);
      const aylikTutar=Math.round(toplamKomisyon/aylik*100)/100;
      for(let i=1;i<=aylik;i++){
        plan.push({donem:`${i}. Ay`,tutar:i===aylik?toplamKomisyon-(aylikTutar*(aylik-1)):aylikTutar,gun:Math.min(i*30,G)});
      }
    } else if(odeme==="uc_aylik"){
      // 3 aylık: her 90 günde bir
      const donem=Math.ceil(G/90);
      const donemTutar=Math.round(toplamKomisyon/donem*100)/100;
      for(let i=1;i<=donem;i++){
        plan.push({donem:`${i}. Çeyrek`,tutar:i===donem?toplamKomisyon-(donemTutar*(donem-1)):donemTutar,gun:Math.min(i*90,G)});
      }
    } else {
      // Flat: tek seferinde
      plan=[{donem:"Vade Sonu",tutar:toplamKomisyon,gun:G}];
    }
    const bsmv = Math.round(toplamKomisyon * 0.05 * 100) / 100;
    const toplamMaliyet = Math.round((toplamKomisyon + bsmv) * 100) / 100;
    // Plan satırlarına da BSMV ekle
    plan = plan.map(p=>({...p, bsmv:Math.round(p.tutar*0.05*100)/100, toplam:Math.round(p.tutar*1.05*100)/100}));
    return{toplamKomisyon,bsmv,toplamMaliyet,plan,gunlukKomisyon:T*gunlukOran};
  },[tutar,oran,vade,odeme])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık"},{v:"uc_aylik",l:"3 Aylık"},{v:"flat",l:"Flat"}]} value={odeme} onChange={setOdeme}/>
        <Field label="TM Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Yıllık Komisyon Oranı" value={oran} onChange={setOran} suffix="%"/>
        <Field label="Vade (Gün)" value={vade} onChange={setVade} suffix="Gün"/>
      </Card>
      {r&&<>
        <Card>
          <SecTitle>TM Komisyon Özeti</SecTitle>
          <RRow label="Günlük Komisyon" value={fmtTL(r.gunlukKomisyon)} sub/>
          <RRow label="Toplam Komisyon" value={fmtTL(r.toplamKomisyon)} accent={C.blue} big/>
          <RRow label="BSMV (%5)" value={fmtTL(r.bsmv)} sub accent={C.red}/>
          <RRow label="Toplam Maliyet" value={fmtTL(r.toplamMaliyet)} accent={C.green} big/>
          <RRow label="Ödeme Şekli" value={odeme==="aylik"?"Aylık":odeme==="uc_aylik"?"3 Aylık":"Flat (Tek Seferinde)"} sub/>
        </Card>
        <Card>
          <SecTitle>Ödeme Planı</SecTitle>
          {r.plan.map((p,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:C.blue}}>{p.donem}</p>
                <p style={{margin:0,fontSize:11,color:C.sub}}>{p.gun}. gün · BSMV: {fmtTL(p.bsmv)}</p>
              </div>
              <span style={{fontSize:15,fontFamily:"monospace",fontWeight:800,color:"#1C1C1E"}}>{fmtTL(p.toplam)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:2}}>
            <span style={{fontSize:13,fontWeight:800,color:C.label}}>TOPLAM</span>
            <span style={{fontSize:15,fontFamily:"monospace",fontWeight:800,color:C.blue}}>{fmtTL(r.toplamMaliyet)}</span>
          </div>
        </Card>
      </>}
    </div>
  );
}

// ─── AKREDİTİF KOMİSYON ──────────────────────────────────────────────────────
function AkreditifKomisyon(){
  const [doviz,setDoviz]=useState("USD");
  const [tutar,setTutar]=useState("");
  const [tolerans,setTolerans]=useState("10");
  const [acilisTarih,setAcilisTarih]=useState("");
  const [sonYuklemeTarih,setSonYuklemeTarih]=useState("");
  const [ibrazGun,setIbrazGun]=useState("21");
  const [komisyonOran,setKomisyonOran]=useState("");

  const DOVIZ_SEMBOL={TL:"₺",USD:"$",EUR:"€"};
  const sembol=DOVIZ_SEMBOL[doviz];
  const fmtDoviz=(n)=>isNaN(n)||n===null?"—":`${sembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  const r=useCallback(()=>{
    const T=parseFloat(tutar);
    if(!T)return null;
    const tolOran=parseFloat(tolerans)||0;
    const maxTutar=Math.round(T*(1+tolOran/100)*100)/100;

    let vadeSuresi=null,ibrazSuresi=null,toplamVade=null,vadeBitis=null;
    if(acilisTarih&&sonYuklemeTarih){
      const ac=new Date(acilisTarih);
      const sy=new Date(sonYuklemeTarih);
      vadeSuresi=Math.round((sy-ac)/(1000*60*60*24));
      ibrazSuresi=parseInt(ibrazGun)||21;
      toplamVade=vadeSuresi+ibrazSuresi;
      vadeBitis=new Date(sy);
      vadeBitis.setDate(vadeBitis.getDate()+ibrazSuresi);
    }

    const oran=parseFloat(komisyonOran);
    if(!oran||!toplamVade)return{maxTutar,tolOran,vadeSuresi,ibrazSuresi,toplamVade,vadeBitis};

    const komisyon=Math.round(maxTutar*(oran/100/365)*toplamVade*100)/100;
    const bsmv=Math.round(komisyon*0.05*100)/100;
    const toplamMaliyet=Math.round((komisyon+bsmv)*100)/100;

    return{maxTutar,tolOran,vadeSuresi,ibrazSuresi,toplamVade,vadeBitis,komisyon,bsmv,toplamMaliyet,oran};
  },[tutar,tolerans,acilisTarih,sonYuklemeTarih,ibrazGun,komisyonOran])();

  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const fmtDate=(d)=>d?`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`:"—";

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <div style={{marginBottom:8,padding:"8px 12px",background:C.blueLight,borderRadius:10}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:C.blue}}>🏦 İthalat Akreditifi</p>
        </div>
        <Seg options={[{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"},{v:"TL",l:"₺ TL"}]} value={doviz} onChange={setDoviz}/>
        <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10}}>
          <Field label={`Akreditif Tutarı (${doviz})`} value={tutar} onChange={setTutar} suffix={sembol}/>
          <Field label="Tolerans" value={tolerans} onChange={setTolerans} suffix="%" hint="Std: %10"/>
        </div>
        {r?.maxTutar&&tutar&&<div style={{background:C.blueLight,borderRadius:10,padding:"9px 12px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.blue,fontWeight:600}}>Tolerans Dahil Azami Tutar</span>
          <span style={{fontSize:15,fontWeight:800,color:C.blue}}>{fmtDoviz(r.maxTutar)}</span>
        </div>}
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Akreditif Açılış Tarihi</label>
        <input type="date" value={acilisTarih} onChange={e=>setAcilisTarih(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",padding:"11px 13px",fontSize:15,fontWeight:600,background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",marginBottom:13}}/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Son Yükleme Tarihi</label>
        <input type="date" value={sonYuklemeTarih} onChange={e=>setSonYuklemeTarih(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",padding:"11px 13px",fontSize:15,fontWeight:600,background:"#F9F9FB",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#1C1C1E",outline:"none",marginBottom:13}}/>
        <Field label="İbraz Süresi (Son yükleme + gün)" value={ibrazGun} onChange={setIbrazGun} suffix="Gün" hint="Standart: 21 gün"/>
        {r?.toplamVade&&<div style={{background:"#F0F4F8",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:C.sub}}>Akreditif Süresi</span>
            <span style={{fontSize:13,fontWeight:700,color:C.label}}>{r.vadeSuresi} gün</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:C.sub}}>+ İbraz Süresi</span>
            <span style={{fontSize:13,fontWeight:700,color:C.label}}>{r.ibrazSuresi} gün</span>
          </div>
          <div style={{height:1,background:C.border,margin:"6px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:700,color:C.label}}>Toplam Vade</span>
            <span style={{fontSize:14,fontWeight:800,color:C.blue}}>{r.toplamVade} gün</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:12,color:C.sub}}>Vade Bitiş Tarihi</span>
            <span style={{fontSize:12,fontWeight:700,color:C.orange}}>{fmtDate(r.vadeBitis)}</span>
          </div>
        </div>}
        <Field label="Komisyon Oranı (Yıllık %)" value={komisyonOran} onChange={setKomisyonOran} suffix="%"/>
      </Card>

      {r?.komisyon!==undefined&&<Card>
        <SecTitle>İthalat Akreditifi Komisyon Analizi ({doviz})</SecTitle>
        <RRow label="Akreditif Tutarı" value={fmtDoviz(parseFloat(tutar)||0)}/>
        <RRow label={`Tolerans (+%${r.tolOran})`} value={fmtDoviz(r.maxTutar-(parseFloat(tutar)||0))} sub accent={C.orange}/>
        <RRow label="Azami Tutar (Komisyon Bazı)" value={fmtDoviz(r.maxTutar)}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label="Toplam Vade" value={`${r.toplamVade} gün`} sub/>
        <RRow label={`Komisyon (%${fmtN(r.oran,4)} × ${r.toplamVade} gün)`} value={fmtDoviz(r.komisyon)}/>
        <RRow label="BSMV (%5)" value={fmtDoviz(r.bsmv)} sub accent={C.red}/>
        <RRow label="Toplam Maliyet" value={fmtDoviz(r.toplamMaliyet)} accent={C.blue} big/>
      </Card>}
    </div>
  );
}


// ─── FİNANSAL GÖSTERGELER ───────────────────────────────────────────────────
function FinansalGostergeler({onKurTikla}:any){
  const [kurlar,setKurlar]=useState(null);
  const [yukleniyor,setYukleniyor]=useState(true);
  const [sonGuncelleme,setSonGuncelleme]=useState(null);
  const [kripto,setKripto]=useState(null);
  const [petrol,setPetrol]=useState(null);
  const [piyasalar,setPiyasalar]=useState(null);

  // Fallback: 24 Haz 2026 19:41 Investing.com
  const FALLBACK=[
    {ad:"USD/TRY",deger:"46,4302",canli:false},
    {ad:"EUR/TRY",deger:"52,7177",canli:false},
    {ad:"GBP/TRY",deger:"61,0739",canli:false},
    {ad:"Gümüş/TRY (Gram)",deger:"88,67",canli:false},
    {ad:"EUR/USD",deger:"1,1351",canli:false},
    {ad:"Altın/TRY (Gram)",deger:"5.994,00",canli:false},
  ];

  useEffect(()=>{
    const loadGostergeler = async () => {
      const fmt=(n,dec)=>n!=null?n.toLocaleString('tr-TR',{minimumFractionDigits:dec,maximumFractionDigits:dec}):null;
      try {
        // Döviz ve altın paralel çek
        const [d, altin, kriptoData, petrolData, piyasalarData] = await Promise.all([
          fetchKurlarViaClaudeAPI(),
          fetch('/api/altin').then(r=>r.ok?r.json():null).catch(()=>null),
          fetch('/api/kripto').then(r=>r.ok?r.json():null).catch(()=>null),
          fetch('/api/petrol').then(r=>r.ok?r.json():null).catch(()=>null),
          fetch('/api/piyasalar').then(r=>r.ok?r.json():null).catch(()=>null),
        ]);
        if(kriptoData?.btc_usd) setKripto(kriptoData);
        if(petrolData?.brent_usd) setPetrol(petrolData);
        if(piyasalarData?.data) setPiyasalar(piyasalarData.data);
        if(d){
          setKurlar([
            {ad:"USD/TRY",          deger:fmt(d.USD_TRY,4),           canli:true},
            {ad:"EUR/TRY",          deger:fmt(d.EUR_TRY,4),           canli:true},
            {ad:"Altın/TRY (Gram)", deger:fmt(altin?.XAU_TRY_gram,2), canli:altin?.XAU_TRY_gram!=null},
            {ad:"Gümüş/TRY (Gram)",deger:fmt(altin?.XAG_TRY_gram,2), canli:altin?.XAG_TRY_gram!=null},
            {ad:"EUR/USD",          deger:fmt(d.EUR_USD,4),            canli:true},
            {ad:"Ons Altın/USD",    deger:fmt(altin?.XAU_USD??piyasalar?.["GC=F"]?.fiyat,2), canli:(altin?.XAU_USD??piyasalar?.["GC=F"]?.fiyat)!=null},
          ]);
          setSonGuncelleme(new Date());
        } else {
          setKurlar(null);
        }
      } catch(e) {
        setKurlar(null);
      }
      setYukleniyor(false);
    };
    loadGostergeler();
    const interval = setInterval(loadGostergeler, 10*60*1000);
    return () => clearInterval(interval);
  },[]);

  const gosterKurlar=kurlar||FALLBACK;
  const canliVar=kurlar!==null;

  const SABIT=[
    {kategori:"Faiz & Para Politikası",icon:"🏛️",color:"#2C5F8A",items:[
      {ad:"TCMB Politika Faizi",deger:"%37,00",tarih:"Haziran 2026"},
      {ad:"TCMB Üst Bant (Borç Verme)",deger:"%40,00",tarih:"Haziran 2026"},
      {ad:"TCMB Alt Bant (Borçlanma)",deger:"%34,00",tarih:"Haziran 2026"},
    ]},
    {kategori:"Enflasyon",icon:"📊",color:"#B83232",items:[
      {ad:"TÜFE (Yıllık)",deger:"%32,61",tarih:"Mayıs 2026"},
      {ad:"TÜFE (Aylık)",deger:"%1,71",tarih:"Mayıs 2026"},
      {ad:"Yİ-ÜFE (Yıllık)",deger:"%28,93",tarih:"Mayıs 2026"},
      {ad:"Yİ-ÜFE (Aylık)",deger:"%2,75",tarih:"Mayıs 2026"},
      {ad:"Çekirdek Enflasyon (C - Yıllık)",deger:"%30,44",tarih:"Mayıs 2026"},
    ]},
    {kategori:"CDS & Risk",icon:"⚡",color:"#9C3060",items:[
      {ad:"Türkiye 5Y CDS",deger:"~250 bps",tarih:"Haziran 2026"},
      {ad:"EMBI+ Türkiye",deger:"~280 bps",tarih:"Haziran 2026"},
    ]},
  ];



  const p=piyasalar;
  const PIYASA_GRUPLARI=[
    {
      baslik:"BORSA ENDEKSLERİ", icon:"📈", color:"#1A5C4A",
      items:[
        {ad:"BIST 100",     sembol:"XU100.IS", para:"₺", dec:0},
        {ad:"S&P 500",      sembol:"^GSPC",    para:"$", dec:2},
        {ad:"NASDAQ",       sembol:"^IXIC",    para:"$", dec:2},
        {ad:"Dow Jones",    sembol:"^DJI",     para:"$", dec:0},
        {ad:"DAX",          sembol:"^GDAXI",   para:"€", dec:2},
      ]
    },
    {
      baslik:"EMTİA", icon:"⚡", color:"#7A5000",
      items:[
        {ad:"Brent Petrol (USD)", sembol:"BZ=F",  para:"$", dec:2},
        {ad:"WTI Ham Petrol",     sembol:"CL=F",  para:"$", dec:2},
        {ad:"Doğalgaz (USD)",     sembol:"NG=F",  para:"$", dec:3},
        {ad:"Altın (Ons/USD)",    sembol:"GC=F",  para:"$", dec:2},
        {ad:"Gümüş (Ons/USD)",   sembol:"SI=F",  para:"$", dec:3},
        {ad:"Bakır (USD)",        sembol:"HG=F",  para:"$", dec:3},
        {ad:"Buğday (c/bu)",      sembol:"ZW=F",  para:"¢", dec:2},
      ]
    },
    {
      baslik:"KRİPTO PARA", icon:"₿", color:"#F7931A",
      items:[
        {ad:"Bitcoin (USD)",  sembol:"BTC-USD", para:"$", dec:0},
        {ad:"Ethereum (USD)", sembol:"ETH-USD", para:"$", dec:2},
      ]
    },
    {
      baslik:"TAHVİL & FAİZ", icon:"🏛️", color:"#2C5F8A",
      items:[
        {ad:"ABD 10Y Tahvil", sembol:"^TNX", para:"%", dec:3},
        {ad:"ABD 2Y Tahvil",  sembol:"^IRX", para:"%", dec:3},
      ]
    },
  ];

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Döviz & Emtia Kurları */}
      <div style={{background:"linear-gradient(135deg,#1C3A5E 0%,#2C5F8A 100%)",borderRadius:16,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontSize:14,fontWeight:800,color:"#fff"}}>💱 Döviz & Emtia</p>
          <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.75)"}}>
            {yukleniyor?"⏳ Yükleniyor...":
             canliVar?`🟢 ${sonGuncelleme?.toLocaleTimeString('tr-TR')} canlı`:
             "🟡 Manuel — 24 Haz 19:41"}
          </p>
        </div>
        {yukleniyor?(
          <div style={{textAlign:"center",padding:"20px"}}>
            <p style={{margin:0,fontSize:22,letterSpacing:8,color:"rgba(255,255,255,0.4)"}}>· · ·</p>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {gosterKurlar.map((k,i)=>(
              <div key={i} onClick={()=>{
                  const sembolMap:any={"USD/TRY":"USDTRY=X","EUR/TRY":"EURTRY=X","GBP/TRY":"GBPTRY=X","Altın/TRY (Gram)":"GC=F","Gümüş/TRY (Gram)":"SI=F","Ons Altın/USD":"GC=F"};
                  const s=sembolMap[k.ad];
                  if(s) onKurTikla?.({kod:k.ad,sembol:s});
                }} style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 12px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.65)",fontWeight:600,flex:1}}>{k.ad}</p>
                  {k.not&&<span style={{fontSize:9,color:"rgba(255,200,0,0.8)",fontWeight:600,flexShrink:0}}>{k.not}</span>}
                </div>
                <p style={{margin:"4px 0 0",fontSize:17,fontWeight:800,color:k.canli?"#fff":"rgba(255,255,255,0.7)",fontFamily:"monospace"}}>{k.deger||"—"}</p>
              </div>
            ))}
          </div>
        )}
        {!yukleniyor&&!canliVar&&(
          <div style={{marginTop:10,background:"rgba(255,200,0,0.15)",borderRadius:8,padding:"7px 12px"}}>
            <p style={{margin:0,fontSize:11,color:"rgba(255,220,100,0.9)"}}>⚠️ Canlı kur alınamadı. Lütfen daha sonra tekrar deneyin.</p>
          </div>
        )}
      </div>

      <div style={{background:"#EBF3FB",borderRadius:10,padding:"9px 12px",marginBottom:14,display:"flex",gap:8,alignItems:"flex-start",border:`1px solid ${C.blue}`}}>
        <span style={{fontSize:13}}>ℹ️</span>
        <p style={{margin:0,fontSize:11,color:C.blue,lineHeight:1.4}}>Altın ve gümüş fiyatları periyodik güncellenir. Anlık takip için TCMB ve Bloomberg'e başvurun.</p>
      </div>




      {PIYASA_GRUPLARI.map((grup,gi)=>(
        <div key={gi} style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px 6px"}}>
            <span style={{fontSize:18}}>{grup.icon}</span>
            <span style={{fontSize:11,fontWeight:800,color:grup.color,letterSpacing:"0.08em"}}>{grup.baslik}</span>
            {piyasalar&&<span style={{fontSize:9,color:"#34C759",fontWeight:700,marginLeft:4}}>● CANLI</span>}
          </div>
          <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            {grup.items.map((item,ii)=>{
              const deger=p?.[item.sembol]?.fiyat;
              const deg=p?.[item.sembol]?.degisim;
              const pozitif=parseFloat(deg)>0;
              return(
                <div key={ii} onClick={()=>onKurTikla?.({kod:item.ad, ad:item.ad, sembol:item.sembol, emtia:true})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:ii<grup.items.length-1?"1px solid #F0F4F8":"none",cursor:"pointer"}}>
                  <div>
                    <p style={{margin:0,fontSize:13,fontWeight:600,color:"#1C2B3A"}}>{item.ad}</p>
                    {deg&&<span style={{fontSize:10,fontWeight:700,color:pozitif?"#16A34A":"#DC2626"}}>{pozitif?"+":""}{deg}%</span>}
                  </div>
                  <span style={{fontSize:14,fontWeight:800,color:deger!=null?grup.color:"#9CA3AF",fontFamily:"monospace"}}>
                    {deger!=null?`${item.para}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:item.dec,maximumFractionDigits:item.dec}).format(deger)}`:"—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {SABIT.map((kat,ki)=>(
        <div key={ki} style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:16}}>{kat.icon}</span>
            <p style={{fontSize:12,fontWeight:800,color:kat.color,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{kat.kategori}</p>
          </div>
          <div style={{background:C.card,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            {kat.items.map((item,ii)=>(
              <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:ii<kat.items.length-1?`1px solid ${C.border}`:"none"}}>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:C.label}}>{item.ad}</p>
                  <p style={{margin:"1px 0 0",fontSize:10,color:C.sub}}>{item.tarih}</p>
                </div>
                <span style={{fontSize:15,fontWeight:800,color:kat.color,fontFamily:"monospace",marginLeft:8}}>{item.deger}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── MENÜ TANIMLARI ──────────────────────────────────────────────────────────
const MENU = {
  home: null,
  katilimMenu:{title:"Katılım Fonu Hesaplama Araçları",back:"home"},
  finansmanMenu:{title:"Bireysel Finansman Araçları",back:"home"},
  toggFinansman:{title:"Togg Finansmanı Hesaplama",back:"finansmanMenu"},
  arsaIsyeri:{title:"Arsa/İşyeri Finansmanı",back:"finansmanMenu"},
  ticariMenu:{title:"Tüzel Finansman Araçları",back:"home"},
  // katılım fonu
  vadeliKatilim:{title:"Katılım Hesabı Getiri Hesaplama",back:"katilimMenu"},
  getiridenAnapara:{title:"Getiriden Anapara Hesaplama",back:"katilimMenu"},
  oranAnalizi:{title:"Günlük Hesap Oran Hesaplama",back:"katilimMenu"},
  tahvilBono:{title:"Sukuk Kira Sertifikası Getiri Hesaplama",back:"katilimMenu"},
  kasaOranAnalizi:{title:"Kasa Hesabı Oran Analizi",back:"katilimMenu"},
  verimlilikAnalizi:{title:"Verimlilik Analizi",back:"katilimMenu"},
  fonGetiriIzleme:{title:"Fon Getiri İzleme ve Hesaplama",back:"katilimMenu"},
  // bireysel finansman (sadece 3)
  konutFinansman:{title:"Konut Finansmanı",back:"finansmanMenu"},
  tasitFinansman:{title:"Taşıt Finansmanı",back:"finansmanMenu"},
  yatirimFonuFinansman:{title:"Yatırım Fonu Finansmanı",back:"finansmanMenu"},
  taksitenKredi:{title:"Taksitten Tutar Hesaplama",back:"finansmanMenu"},
  // ticari finansman (spot + leasing + taksitli ticari)
  spotFinansman:{title:"Spot Finansman",back:"ticariMenu"},
  taksitliTicari:{title:"Taksitli Ticari Finansman",back:"ticariMenu"},
  leasing:{title:"Finansal Kiralama",back:"ticariMenu"},
  posHesaplama:{title:"POS Komisyon Hesaplama",back:"ticariMenu"},
  tmKomisyon:{title:"Teminat Mektubu Komisyon Hesaplama",back:"ticariMenu"},
  akreditifKomisyon:{title:"Akreditif Komisyon Hesaplama",back:"ticariMenu"},
  esnekOdemePlanlari:{title:"Esnek Ödeme Planları",back:"ticariMenu"},
  esitAnapara:{title:"Eşit Anapara Ödeme Planı",back:"esnekOdemePlanlari"},
  araOdemeli:{title:"Ara Ödemeli Plan",back:"esnekOdemePlanlari"},
  artanOdemeli:{title:"Artan Ödemeli Plan",back:"esnekOdemePlanlari"},
  azalanOdemeli:{title:"Azalan Ödemeli Plan",back:"esnekOdemePlanlari"},
  balonOdemeli:{title:"Balon Ödemeli Plan",back:"esnekOdemePlanlari"},
  esnekOdemeli:{title:"Esnek Ödemeli Plan",back:"esnekOdemePlanlari"},
  // diğer
  asistan:{title:"VK Asistan",back:"home"},
  sozluk:{title:"Katılım Bankacılığı Sözlüğü",back:"home"},
  gecmis:{title:"Son Hesaplamalar",back:"home"},
  finansalTakvim:{title:"Finansal Takvim",back:"home"},
  finansalGostergeler:{title:"Finansal Göstergeler",back:"home"},
  ayarlar:{title:"Ayarlar",back:"home"},
};

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
// ─── POS KÂRLILİK ANALİZİ ────────────────────────────────────────────────────
function PosHesaplama({s}){
  const [ciro,       setCiro]       = useState("");  // ZORUNLU - aylık POS cirosu
  const [komisyon,   setKomisyon]   = useState("");  // uygulanan komisyon %
  const [blokGun,    setBlokGun]    = useState("");  // bloke / valör gün
  const [cariOrt,    setCariOrt]    = useState("");  // cari hesap aylık ortalama ₺
  const [vadOrt,     setVadOrt]     = useState("");  // vadeli katılım aylık ortalama ₺
  const [cariKarPay, setCariKarPay] = useState(()=>String(s.cariKarPayiOran||35));
  const [vadKarPay,  setVadKarPay]  = useState(()=>String(s.katilimKarPayiOran||2));

  const referans   = parseFloat(s.referansOran) || 3.11;
  const bkmTakas   = parseFloat(s.bkmTakas)     || 3.36;
  const AZAMI_KOM  = parseFloat((referans + 0.45).toFixed(4));
  const AZAMI_BLOK = 40;

  const ciroVal  = parseFloat(ciro)      || 0;
  const komVal   = parseFloat(komisyon)  || 0;
  const blokVal  = parseFloat(blokGun)   || 0;
  const cariVal  = parseFloat(cariOrt)   || 0;
  const vadVal   = parseFloat(vadOrt)    || 0;
  const cariKO   = (parseFloat(cariKarPay) || 0) / 12;  // aylık %
  const vadKO    = (parseFloat(vadKarPay)  || 0) / 12;  // aylık %

  // ── Kural kontrolleri ─────────────────────────────────────────────────────
  // Müşteri efektif maliyet: komisyon × (1 + blokGün/30) ≤ 3,56
  // Tebliğ formülü: maxKom = (1 - blokGün/AZAMI_BLOK) × AZAMI_KOM
  // 40 gün → maxKom=0, 39 gün → maxKom=%0.089, 0 gün → maxKom=%3.56
  const efektifMusteri = komVal; // direkt komisyon kontrolü (komVal > maxKomForBlok)

  // Max izinli komisyon bu bloke için
  const maxKomForBlok = parseFloat((AZAMI_KOM * (1 - blokVal / AZAMI_BLOK)).toFixed(4));

  // Max izinli bloke bu komisyon için: 30 × (3,56/komisyon - 1), max 40 gün
  const maxBlokForKom = komVal > 0
    ? Math.min(Math.floor(AZAMI_BLOK * (1 - komVal / AZAMI_KOM)), AZAMI_BLOK)
    : AZAMI_BLOK;

  const hatalar = [];

  if(komisyon !== "" && komVal > AZAMI_KOM)
    hatalar.push(`Komisyon oranı tavanı %${fmtN(AZAMI_KOM,4)}'i aşıyor.`);

  if(blokGun !== "" && blokVal > AZAMI_BLOK)
    hatalar.push(`Bloke gün sayısı tavanı ${AZAMI_BLOK} günü aşıyor.`);

  // İkisi de girilmişse kombinasyon kontrolü
  if(komisyon !== "" && blokGun !== "" && komVal > maxKomForBlok){
    hatalar.push(
      `%${fmtN(komVal,4)} komisyon + ${blokVal} gün bloke geçersiz — tebliğ gereği max komisyon %${fmtN(maxKomForBlok,4)} olmalıdır.\n` +
      `• Bu komisyon için maksimum bloke: ${Math.max(0,maxBlokForKom)} gün\n` +
      `• Bu bloke için maksimum komisyon: %${fmtN(maxKomForBlok,4)}`
    );
  }

  // İki alan da dolu mu (0 dahil geçerli)
  const girislerTam = komisyon !== "" && blokGun !== "";

  // ── Hesap ─────────────────────────────────────────────────────────────────
  const r = useCallback(()=>{
    if(!ciroVal || !girislerTam) return null;

    // 1. BKM TAKAS MALİYETİ
    const bkmMaliyet = ciroVal * bkmTakas / 100;

    // 2. KOMİSYON GELİRİ — banka tam komisyonu alır, bloke ayrı gelir
    const efKom = komVal; // banka komisyonu tam tahsil eder
    const komisyonGeliri = ciroVal * efKom / 100;

    // 3. BLOKE GÜN FAYDA GELİRİ
    //    Formül: Ciro × blokGün × fonlama_oranı / 36500
    //    Bloke > 14 gün ise ZK oranı uygulanır (vadesiz ZK: zkTL_vadesiz)
    const fonlamaOran = parseFloat(s.fonlamaMaliyeti) || 24.0;
    const zkBlokeOran = blokVal > 14 ? (parseFloat(s.zkTL_vadesiz) || 17) / 100 : 0;
    const ciroKullanilabilir = ciroVal * (1 - zkBlokeOran);
    // Bloke getirisi: cari hesap kâr payı oranı kullanılır (fonlama maliyeti yerine)
    const blokeKarPayiOran = parseFloat(cariKarPay) || fonlamaOran;
    const blokeGeliri = blokVal > 0 ? ciroKullanilabilir * blokVal * blokeKarPayiOran / 36500 : 0;

    // 4. CARİ HESAP GELİRİ
    //    ZK oranı düşüldükten sonra kalan tutar üzerinden hesapla
    //    Cari = vadesiz → ZK oranı: zkTL_vadesiz
    const zkCariOran = (parseFloat(s.zkTL_vadesiz) || 17) / 100;
    const cariKullanilabilir = cariVal * (1 - zkCariOran);
    const cariGelir = cariKullanilabilir * cariKO / 100;

    // 5. VADELİ KATILIM GELİRİ
    //    Vadeli → ZK oranı: zkTL_6ay
    const zkVadOran = (parseFloat(s.zkTL_6ay) || 10) / 100;
    const vadKullanilabilir = vadVal * (1 - zkVadOran);
    const vadGelir = vadKullanilabilir * vadKO / 100;

    // 6. TOPLAM GELİR & MALİYET
    const toplamGelir   = komisyonGeliri + blokeGeliri + cariGelir + vadGelir;
    // 6b. DİĞER MALİYETLER (Visa/MC komisyonu, bakım vb.)
    // Ciro × ‱5 (onbinde 5)
    const digerMaliyet = Math.round(ciroVal * 0.0005 * 100) / 100;
    const toplamMaliyet = bkmMaliyet + digerMaliyet;

    // 7. NET KÂR / ZARAR
    const netSonuc = toplamGelir - toplamMaliyet;

    // 8. ÖNERİLER (sadece zarar varsa)
    // Zararı sıfırlamak için gereken minimum ek gelir
    const zararTutar = netSonuc < 0 ? Math.abs(netSonuc) : 0;

    // A) Komisyon oranı önerisi (bloke sabit, komisyon artır)
    // Gereken toplam komisyon geliri = toplamMaliyet - blokeGeliri
    const onerKomHam = (toplamMaliyet - blokeGeliri) / ciroVal * 100;
    // Efektif maliyet tavan kontrolü: onerKom * (1 + blokVal/30) ≤ AZAMI_KOM
    // Tebliğ: maxKomForBlok = AZAMI_KOM * (1 - blokGün/AZAMI_BLOK)
    const efektifOnerKom = onerKomHam; // artık doğrudan komVal ile kıyaslanır
    const onerKom = Math.min(parseFloat(onerKomHam.toFixed(4)), maxKomForBlok);
    const onerKomYeterli = onerKomHam <= maxKomForBlok;
    const onerKomEfektifAsim = onerKomHam > maxKomForBlok && onerKomHam <= AZAMI_KOM;

    // B) Bloke gün önerisi — mevcut bloke üzerine ek gün
    const zkOranBlok = (parseFloat(s.zkTL_vadesiz) || 17) / 100;
    // Max izinli TOPLAM bloke gün (mevcut komisyon için)
    const maxBlokForKomOner = komVal > 0
      ? Math.min(Math.floor(AZAMI_BLOK * (1 - komVal / AZAMI_KOM)), AZAMI_BLOK)
      : AZAMI_BLOK;

    // Mevcut bloke geliri zaten hesaplanmış (blokeGeliri)
    // Sadece EK GELİR GEREKİYOR = zararTutar
    // Ek bloke geliri = ciroKull * ekGun * fonlamaOran / 36500 = zararTutar
    // ekGun = zararTutar * 36500 / (ciroKull * fonlamaOran)
    const ciroKullMevcut = blokVal > 14 ? ciroVal*(1-zkOranBlok) : ciroVal;
    const ekGunZksiz = zararTutar * 36500 / (ciroVal * blokeKarPayiOran);
    const ekGunZkli  = zararTutar * 36500 / (ciroVal*(1-zkOranBlok) * fonlamaOran);

    // Toplam bloke hedefi
    let toplamBlokHedef, onerBlokZkUygulanir;
    // Check if adding ekGunZksiz keeps us ≤14 total
    if(blokVal + Math.ceil(ekGunZksiz) <= 14){
      toplamBlokHedef = blokVal + Math.ceil(ekGunZksiz);
      onerBlokZkUygulanir = false;
    } else {
      // ZK applies on total — need to recalculate from scratch with ZK
      // Toplam blok = (blokeGeliri_mevcut + zararTutar) * 36500 / (ciro*(1-zk)*fonlama)
      const toplamGelirHedef = blokeGeliri + zararTutar;
      toplamBlokHedef = Math.ceil(toplamGelirHedef * 36500 / (ciroVal*(1-zkOranBlok)*blokeKarPayiOran));
      onerBlokZkUygulanir = true;
    }

    const onerEkGun = Math.max(0, toplamBlokHedef - blokVal);
    const onerBlokToplam = toplamBlokHedef;

    // Tavan kontrolü: mevcut komisyon + toplamBlokHedef ≤ AZAMI_KOM?
    const efektifYeni = komVal * (1 + toplamBlokHedef / 30);
    let onerBlok, onerBlokKombine=null;

    if(blokVal >= AZAMI_BLOK){
      // Bloke zaten maksimumda → B = sadece komisyon artır (A ile aynı)
      onerBlok = blokVal;
    } else if(efektifYeni <= AZAMI_KOM && toplamBlokHedef <= AZAMI_BLOK){
      // Sadece bloke yeterli
      onerBlok = toplamBlokHedef;
    } else {
      // Tavan aşılıyor → max izinli bloke + ek komisyon
      const blokKombine = Math.min(maxBlokForKomOner, AZAMI_BLOK);
      const ciroKullK = blokKombine > 14 ? ciroVal*(1-zkOranBlok) : ciroVal;
      const blokeGeliriK = ciroKullK * blokKombine * blokeKarPayiOran / 36500;
      const kalanZarar = toplamMaliyet - komisyonGeliri - blokeGeliriK;
      const ekKomOran = kalanZarar > 0 ? kalanZarar / ciroVal * 100 : 0;
      const kombineKom = parseFloat((komVal + ekKomOran).toFixed(4));
      const kombineEfektif = parseFloat((kombineKom * (1 + blokKombine / 30)).toFixed(4));
      onerBlok = blokKombine;
      onerBlokKombine = {
        blok: blokKombine, ekGun: Math.max(0,blokKombine-blokVal),
        kom: kombineKom, efektif: kombineEfektif,
        tavanAsim: kombineEfektif > AZAMI_KOM,
      };
    }
    const onerBlokYeterli = !onerBlokKombine && onerBlok <= AZAMI_BLOK;
    const onerEkGunGoster = onerBlok - blokVal;

    // C) Cari hesap bakiyesi önerisi (komisyon+bloke sabit, cari bakiye artır)
    // Ek cari gelir = onerCariBakiye × (1-zkCariOran) × cariKO/100 = zararTutar
    // onerCariBakiye = zararTutar / ((1-zkCariOran) × cariKO/100)
    const onerCariBakiye = cariKO > 0
      ? Math.ceil(zararTutar / ((1-zkCariOran) * cariKO / 100) / 1000) * 1000
      : null;

    // D) Vadeli katılım bakiyesi önerisi
    // onerVadBakiye = zararTutar / ((1-zkVadOran) × vadKO/100)
    const onerVadBakiye = vadKO > 0
      ? Math.ceil(zararTutar / ((1-zkVadOran) * vadKO / 100) / 1000) * 1000
      : null;

    return{
      ciroVal, komVal, blokVal, efKom: komVal,
      bkmMaliyet, digerMaliyet, komisyonGeliri, blokeGeliri, blokeKarPayiOran, cariGelir, vadGelir,
      toplamGelir, toplamMaliyet, netSonuc, zararTutar,
      onerKom, onerKomYeterli, onerKomEfektifAsim, efektifOnerKom, onerBlok, onerBlokYeterli, onerBlokZkUygulanir, onerBlokKombine, onerEkGunGoster, onerBlokMaks:blokVal>=AZAMI_BLOK&&maxKomForBlok<=0,
      onerCariBakiye, onerVadBakiye,
      cariVal, vadVal, cariKO, vadKO,
      fonlamaOran,
      zkCariOran, zkVadOran,
      cariKullanilabilir, vadKullanilabilir,
      zkBlokeOran, ciroKullanilabilir,
    };
  },[ciro,komisyon,blokGun,cariOrt,vadOrt,cariKarPay,vadKarPay,s.referansOran,s.bkmTakas])();

  return(
    <div style={{padding:"0 16px 32px"}}>

      {/* GİRİŞ */}
      <Card>
        <SecTitle>POS Cirosu (Zorunlu)</SecTitle>
        <Field label="Aylık POS Cirosu" value={ciro} onChange={setCiro} suffix="₺"
          hint="Tüm hesaplama bu ciroya göre yapılır"/>
      </Card>

      <Card>
        <SecTitle>Komisyon & Bloke</SecTitle>
        <Field label="Uygulanacak Komisyon Oranı" value={komisyon} onChange={setKomisyon}
          suffix="%" hint={`Tavan: %${fmtN(AZAMI_KOM,4)} — BKM Takas: %${fmtN(bkmTakas,2)}${girislerTam && blokVal>0 ? ` — ${blokVal} gün bloke için max: %${fmtN(maxKomForBlok,4)} · Efektif: kom×(1+gün/30)≤${fmtN(AZAMI_KOM,4)}` : ""}`}/>
        <Field label="Bloke / Valör Gün Sayısı" value={blokGun} onChange={setBlokGun}
          suffix="Gün" hint={`Tavan: ${AZAMI_BLOK} gün${girislerTam && komVal>0 ? ` — %${fmtN(komVal,4)} komisyon için max: ${Math.max(0,maxBlokForKom)} gün` : ""}`}/>
        {hatalar.map((h,i)=>(
          <div key={i} style={{background:"#FEF2F2",borderRadius:8,padding:"8px 10px",marginBottom:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ {h}</p>
          </div>
        ))}
      </Card>

      <Card>
        <SecTitle>Hesap Ortalamaları</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Cari Ortalama" value={cariOrt} onChange={setCariOrt} suffix="₺"/>
          <Field label="Cari Kâr Payı" value={cariKarPay} onChange={setCariKarPay} suffix="% Yıllık"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Katılım Ortalama" value={vadOrt} onChange={setVadOrt} suffix="₺"/>
          <Field label="Katılım Kâr Payı" value={vadKarPay} onChange={setVadKarPay} suffix="% Yıllık"/>
        </div>
      </Card>

      {/* SONUÇLAR */}
      {r && hatalar.length === 0 && girislerTam && (
        <>
          <Card>
            <SecTitle>Kâr / Zarar Analizi</SecTitle>

            {/* MALİYET */}
            <div style={{background:"#FEF2F2",borderRadius:10,padding:"11px 14px",marginBottom:10}}>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                📤 Maliyet
              </p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.sub}}>BKM Takas ({fmtTL(r.ciroVal)} × %{fmtN(bkmTakas,2)})</span>
                <span style={{fontSize:15,fontWeight:800,color:C.red,fontFamily:"monospace"}}>- {fmtTL(r.bkmMaliyet)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
                <span style={{fontSize:12,color:C.sub}}>Diğer Maliyetler (Visa/MC, bakım vb. — cirosunun ‱5)</span>
                <span style={{fontSize:15,fontWeight:800,color:C.red,fontFamily:"monospace"}}>- {fmtTL(r.digerMaliyet)}</span>
              </div>
            </div>

            {/* GELİRLER */}
            <div style={{background:C.greenLight,borderRadius:10,padding:"11px 14px",marginBottom:10}}>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                📥 Gelirler
              </p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:12,color:C.sub}}>
                  Komisyon ({fmtTL(r.ciroVal)} × %{fmtN(r.komVal,4)})
                </span>
                <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.komisyonGeliri)}</span>
              </div>
              {r.blokVal > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:12,color:C.sub}}>
                    Bloke Faydası ({fmtTL(r.ciroKullanilabilir)} × {r.blokVal} gün × %{fmtN(r.blokeKarPayiOran,2)} (Cari KP) ÷ 36500
                    {r.zkBlokeOran>0?` — ZK %${fmtN(r.zkBlokeOran*100,0)} düşüldü`:""})
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:C.teal,fontFamily:"monospace"}}>+ {fmtTL(r.blokeGeliri)}</span>
                </div>
              )}
              {r.cariVal > 0 && r.cariKO > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:12,color:C.sub}}>
                    Cari ({fmtTL(r.cariKullanilabilir)} × %{fmtN(r.cariKO,4)}/ay — ZK %{fmtN(r.zkCariOran*100,0)} düşüldü)
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.cariGelir)}</span>
                </div>
              )}
              {r.vadVal > 0 && r.vadKO > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.sub}}>
                    Vadeli ({fmtTL(r.vadKullanilabilir)} × %{fmtN(r.vadKO,4)}/ay — ZK %{fmtN(r.zkVadOran*100,0)} düşüldü)
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.vadGelir)}</span>
                </div>
              )}
              {r.blokVal > 0 && (
                <div style={{background:"#F0F4F8",borderRadius:8,padding:"8px 10px",marginTop:6}}>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>
                    Formül: Ciro × Bloke Gün × Oran ÷ 36500 — Oran: %{fmtN(r.fonlamaOran,2)} (Ayarlar → Fonlama Maliyeti)
                  </p>
                </div>
              )}
              <div style={{height:1,background:"rgba(0,0,0,0.08)",margin:"8px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:C.green}}>Toplam Gelir</span>
                <span style={{fontSize:15,fontWeight:800,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.toplamGelir)}</span>
              </div>
            </div>

            {/* NET SONUÇ */}
            <div style={{
              background: r.netSonuc >= 0 ? "#F0FDF4" : "#FEF2F2",
              borderRadius:14, padding:"16px",
              border:`2.5px solid ${r.netSonuc >= 0 ? C.green : C.red}`
            }}>
              <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",
                color: r.netSonuc >= 0 ? C.green : C.red}}>
                {r.netSonuc >= 0 ? "✅ NET KÂR" : "❌ NET ZARAR"}
              </p>
              <p style={{margin:0,fontSize:32,fontWeight:900,fontFamily:"monospace",
                color: r.netSonuc >= 0 ? C.green : C.red}}>
                {r.netSonuc >= 0 ? "+" : ""}{fmtTL(r.netSonuc)}
              </p>
              <p style={{margin:"6px 0 0",fontSize:11,color:C.sub}}>
                Aylık net — {fmtTL(r.ciroVal)} ciro üzerinden
              </p>
            </div>
          </Card>

          {/* ÖNERİLER — sadece zarar varsa */}
          {r.netSonuc < 0 && (
          <Card>
            <SecTitle>💡 Zararı Sıfırlama Önerileri</SecTitle>
            <p style={{margin:"0 0 10px",fontSize:12,color:C.sub}}>
              Aylık {fmtTL(r.zararTutar)} zararı gidermek için aşağıdaki seçeneklerden biri yeterli:
            </p>

            {/* A: Komisyon */}
            <div style={{background:r.onerKomYeterli?C.blueLight:r.onerKomEfektifAsim?"#FEF2F2":"#FFF8F0",borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${r.onerKomYeterli?C.blue:r.onerKomEfektifAsim?C.red:C.orange}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:r.onerKomYeterli?C.blue:r.onerKomEfektifAsim?C.red:C.orange}}>
                    {r.onerKomYeterli?"✅":r.onerKomEfektifAsim?"⛔":"⚠️"} A) Komisyon Oranını Artır
                  </p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>Bloke değişmez, komisyon yukarı çekilir</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{margin:0,fontSize:22,fontWeight:900,color:r.onerKomYeterli?C.blue:r.onerKomEfektifAsim?C.red:C.orange,fontFamily:"monospace"}}>
                    %{fmtN(r.onerKom,4)}
                  </p>
                  {r.onerKomEfektifAsim&&<p style={{margin:0,fontSize:10,color:C.red}}>max: %{fmtN(maxKomForBlok,4)}</p>}
                </div>
              </div>
              {r.onerKomEfektifAsim&&<p style={{margin:"6px 0 0",fontSize:10,color:C.red}}>⛔ Tebliğ gereği {blokVal} gün bloke ile max komisyon %{fmtN(maxKomForBlok,4)} olabilir. B) seçeneğini kullanın.</p>}
              {!r.onerKomYeterli&&!r.onerKomEfektifAsim&&<p style={{margin:"6px 0 0",fontSize:10,color:C.orange}}>⚠️ Tavan %{fmtN(AZAMI_KOM,4)} — bu oran tek başına yetmez</p>}
            </div>

            {/* B: Bloke */}
            <div style={{background:r.onerBlokMaks?"#FEF2F2":r.onerBlokKombine?C.orangeLight:r.onerBlokYeterli?C.blueLight:"#FFF8F0",borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${r.onerBlokMaks?C.red:r.onerBlokKombine?C.orange:r.onerBlokYeterli?C.blue:C.orange}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                <div style={{flex:1}}>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:r.onerBlokMaks?C.red:r.onerBlokKombine?C.orange:r.onerBlokYeterli?C.blue:C.orange}}>
                    {r.onerBlokMaks?"⛔":r.onerBlokKombine?"⚡":"✅"} B) {r.onerBlokMaks?"Bloke Maksimumda":r.onerBlokKombine?"Bloke + Komisyon Kombine":"Bloke Gün Sayısını Artır"}
                  </p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>
                    {r.onerBlokMaks
                      ? `Bloke ${AZAMI_BLOK} gün tavanda — komisyon da %0,00 zorunlu`
                      : r.onerBlokKombine
                      ? `Max izinli toplam: ${r.onerBlok} gün (+${r.onerBlokKombine.ekGun} gün) + ek komisyon`
                      : `Mevcut ${blokVal} gün → ${r.onerBlok} gün (+${r.onerEkGunGoster} gün)${r.onerBlokZkUygulanir?" · ZK %17 dahil":""}`}
                  </p>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{textAlign:"right"}}>
                    <p style={{margin:0,fontSize:11,color:C.sub}}>{r.onerBlok} gün toplam</p>
                    {r.onerBlokMaks
                    ? <p style={{margin:0,fontSize:11,fontWeight:700,color:C.red}}>Tebliğ gereği bu kombinasyonda kazanç mümkün değil. C/D seçeneklerini değerlendirin.</p>
                    : r.onerEkGunGoster===0&&!r.onerBlokKombine
                    ? <p style={{margin:0,fontSize:13,fontWeight:700,color:C.sub}}>Bloke maks. · Kom. artır</p>
                    : <p style={{margin:0,fontSize:18,fontWeight:900,color:r.onerBlokKombine?C.orange:r.onerBlokYeterli?C.blue:C.orange,fontFamily:"monospace"}}>
                        +{r.onerBlokKombine?r.onerBlokKombine.ekGun:r.onerEkGunGoster} gün
                      </p>}
                    {r.onerBlokKombine&&<p style={{margin:0,fontSize:13,fontWeight:800,color:r.onerBlokKombine.tavanAsim?C.red:C.orange,fontFamily:"monospace"}}>
                      %{fmtN(r.onerBlokKombine.kom,4)} kom.
                    </p>}
                  </div>
                </div>
              </div>
              {r.onerBlokKombine&&<div style={{marginTop:8,padding:"6px 10px",background:"rgba(0,0,0,0.05)",borderRadius:8}}>
                <p style={{margin:0,fontSize:10,color:r.onerBlokKombine.tavanAsim?C.red:C.sub}}>
                  {r.onerBlokKombine.tavanAsim
                    ? `⛔ Bu kombine efektif maliyet %${fmtN(r.onerBlokKombine.efektif,4)} — tavan aşılıyor, komisyon oranını artırın`
                    : `Efektif maliyet: %${fmtN(r.onerBlokKombine.efektif,4)} ✓ — tavan ${fmtN(AZAMI_KOM,4)} içinde`}
                </p>
              </div>}
              {!r.onerBlokYeterli&&!r.onerBlokKombine&&<p style={{margin:"6px 0 0",fontSize:10,color:C.orange}}>⚠️ Tavan {AZAMI_BLOK} gün — bu süre tek başına yetmez</p>}
            </div>

            {/* C: Cari hesap */}
            {r.onerCariBakiye&&<div style={{background:C.greenLight,borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${C.green}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.green}}>✅ C) Cari Hesap Bakiyesi Getir</p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>%{fmtN(parseFloat(cariKarPay),2)} yıllık oranla, ZK düşüldükten sonra</p>
                </div>
                <p style={{margin:0,fontSize:22,fontWeight:900,color:C.green,fontFamily:"monospace"}}>
                  {new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0,minimumFractionDigits:0}).format(r.onerCariBakiye)}
                </p>
              </div>
            </div>}

            {/* D: Vadeli katılım */}
            {r.onerVadBakiye&&<div style={{background:"#F0EDF8",borderRadius:10,padding:"12px 14px",border:`1.5px solid ${C.purple}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.purple}}>✅ D) Katılım Hesabı Bakiyesi Getir</p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>%{fmtN(parseFloat(vadKarPay),2)} yıllık oranla, ZK düşüldükten sonra</p>
                </div>
                <p style={{margin:0,fontSize:22,fontWeight:900,color:C.purple,fontFamily:"monospace"}}>
                  {new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0,minimumFractionDigits:0}).format(r.onerVadBakiye)}
                </p>
              </div>
            </div>}

            {!r.onerCariBakiye&&!r.onerVadBakiye&&<p style={{margin:"8px 0 0",fontSize:11,color:C.sub}}>
              💡 C ve D önerileri için hesap ortalamaları ve kâr payı oranlarını girin
            </p>}
          </Card>
          )}

          <RaporButon baslik="POS Kârlılık Analizi" plan={null} satirlar={[
            {label:"Aylık POS Cirosu", value:fmtTL(r.ciroVal), big:true},
            {label:`Komisyon Geliri (%${fmtN(r.efKom,4)} efektif)`, value:fmtTL(r.komisyonGeliri)},
            r.blokeGeliri>0?{label:`Bloke Gün Faydası (${r.blokVal} gün)`, value:fmtTL(r.blokeGeliri)}:null,
            r.cariGelir>0?{label:"Cari Hesap Geliri", value:fmtTL(r.cariGelir)}:null,
            r.vadGelir>0?{label:"Vadeli Katılım Geliri", value:fmtTL(r.vadGelir)}:null,
            {label:"Toplam Gelir", value:fmtTL(r.toplamGelir)},
            {label:`BKM Takas Maliyeti (%${fmtN(bkmTakas,2)})`, value:`- ${fmtTL(r.bkmMaliyet)}`},
            {label:"NET SONUÇ", value:`${r.netSonuc>=0?"+":""}${fmtTL(r.netSonuc)}`, big:true},
          ].filter(Boolean)}/>
        </>
      )}

      {(!ciroVal || !girislerTam) && (
        <div style={{background:C.blueLight,borderRadius:12,padding:"14px 16px",border:`1.5px solid ${C.blue}`}}>
          <p style={{margin:0,fontSize:13,color:C.blue,fontWeight:700}}>
            {!ciroVal ? "ℹ️ Aylık POS cirosunu girerek başlayın." : "ℹ️ Komisyon ve bloke gün sayısı zorunludur (0 yazılabilir)."}
          </p>
        </div>
      )}
    </div>
  );
}
// Artifact ortamında CORS nedeniyle dış API çalışmaz.
// Vercel serverless function üzerinden kur çekiyoruz (CORS sorunu yok)
const fetchKurlarViaClaudeAPI = async () => {
  try {
    const res = await fetch("/api/kur");
    if (!res.ok) return null;
    return await res.json();
  } catch(e) {
    return null;
  }
};

function gecmisKaydet(gecmis, setGecmis, kayit){
  const yeni = {
    id: Date.now(),
    tarih: new Date().toLocaleString("tr-TR"),
    ...kayit
  };
  setGecmis(prev => {
    const updated = [yeni, ...prev.filter(g=>g.id!==yeni.id)].slice(0,10);
    try{ localStorage.setItem("vk_gecmis", JSON.stringify(updated)); }catch(e){}
    return updated;
  });
}

// ─── BİLDİRİM MODAL ─────────────────────────────────────────────────────────
// ─── KUR GRAFİK MODAL ────────────────────────────────────────────────────────
function KurGrafikModal({kur, onClose}:{kur:any, onClose:()=>void}){
  const [veri,setVeri]=useState<any>(null);
  const [yukleniyor,setYukleniyor]=useState(true);
  const [tooltip,setTooltip]=useState<any>(null);
  const fmt2=(n:any)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  // Sembol haritası
  const sembolMap:any={
    "USD":"USDTRY=X","EUR":"EURTRY=X","GBP":"GBPTRY=X",
    "SAR":"SARTRY=X","AED":"AEDTRY=X","100 JPY":"JPYTRY=X",
    "Altın (g)":"GC=F","Gümüş (g)":"SI=F","BTC":"BTC-USD",
    "USD/TRY":"USDTRY=X","EUR/TRY":"EURTRY=X","GBP/TRY":"GBPTRY=X",
    "Altın/TRY (Gram)":"GC=F","Gümüş/TRY (Gram)":"SI=F","Ons Altın/USD":"GC=F",
  };
  const sembol=kur.sembol||sembolMap[kur.kod]||kur.kod;

  useEffect(()=>{
    setYukleniyor(true);
    fetch(`/api/gecmis?sembol=${encodeURIComponent(sembol)}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{setVeri(d);setYukleniyor(false);})
      .catch(()=>setYukleniyor(false));
  },[sembol]);

  const noktalar=veri?.noktalar||[];
  const fiyatlar=noktalar.map((n:any)=>n.fiyat).filter(Boolean);
  const minF=Math.min(...fiyatlar);
  const maxF=Math.max(...fiyatlar);
  const aralik=maxF-minF||1;
  const degisim=veri?.guncelFiyat&&veri?.oncekiKapanis?
    ((veri.guncelFiyat-veri.oncekiKapanis)/veri.oncekiKapanis*100).toFixed(2):null;
  const pozitif=degisim&&parseFloat(degisim)>=0;

  const W=320, H=140, PAD=8;
  const getX=(i:number)=>PAD+(i/(noktalar.length-1||1))*(W-PAD*2);
  const getY=(f:number)=>H-PAD-((f-minF)/aralik)*(H-PAD*2);

  const pathD=noktalar.length>1?noktalar.map((n:any,i:number)=>
    `${i===0?"M":"L"}${getX(i).toFixed(1)},${getY(n.fiyat).toFixed(1)}`
  ).join(" "):"";

  const areaD=noktalar.length>1?`${pathD} L${getX(noktalar.length-1).toFixed(1)},${H} L${getX(0).toFixed(1)},${H} Z`:"";

  const etiket=kur.kripto?"USD":kur.altin?"TL":"TL";

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:600,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        {/* Başlık */}
        <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #F0F4F8",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <p style={{margin:0,fontSize:18,fontWeight:800,color:"#1C2B3A"}}>
              {kur.emtia ? (kur.ad || kur.kod)
                : kur.altin ? kur.kod
                : kur.kripto ? kur.kod+"/USD"
                : kur.kod+"/TRY"}
            </p>
            <p style={{margin:"2px 0 0",fontSize:11,color:"#6B7B8D"}}>Son 30 Gün</p>
          </div>
          <button onClick={onClose} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px 32px"}}>
          {yukleniyor?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <p style={{color:"#6B7B8D",fontSize:14}}>⏳ Yükleniyor...</p>
            </div>
          ):!veri||noktalar.length===0?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <p style={{color:"#B83232",fontSize:14}}>Veri alınamadı</p>
            </div>
          ):(
            <>
              {/* Özet */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div style={{background:"#F8FAFB",borderRadius:10,padding:"10px 12px"}}>
                  <p style={{margin:0,fontSize:10,color:"#6B7B8D",fontWeight:600}}>GÜNCEL FİYAT</p>
                  <p style={{margin:"4px 0 0",fontSize:16,fontWeight:800,color:"#1C2B3A",fontFamily:"monospace"}}>{fmt2(veri.guncelFiyat)}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF"}}>{veri.para} cinsinden</p>
                </div>
                <div style={{background:"#F8FAFB",borderRadius:10,padding:"10px 12px"}}>
                  <p style={{margin:0,fontSize:10,color:"#6B7B8D",fontWeight:600}}>ÖNCEKİ KAPANIS</p>
                  <p style={{margin:"4px 0 0",fontSize:16,fontWeight:800,color:"#1C2B3A",fontFamily:"monospace"}}>{fmt2(veri.oncekiKapanis)}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF"}}>{noktalar[noktalar.length-2]?.tarih||"—"}</p>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"#F8FAFB",borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:0,fontSize:9,color:"#6B7B8D",fontWeight:600}}>30G EN DÜŞÜK</p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:"#1C3A5E",fontFamily:"monospace"}}>{fmt2(minF)}</p>
                  <p style={{margin:"1px 0 0",fontSize:9,color:"#9CA3AF"}}>{noktalar.find((n:any)=>n.fiyat===minF)?.tarih||"—"}</p>
                </div>
                <div style={{background:"#F8FAFB",borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:0,fontSize:9,color:"#6B7B8D",fontWeight:600}}>30G EN YÜKSEK</p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:"#1C3A5E",fontFamily:"monospace"}}>{fmt2(maxF)}</p>
                  <p style={{margin:"1px 0 0",fontSize:9,color:"#9CA3AF"}}>{noktalar.find((n:any)=>n.fiyat===maxF)?.tarih||"—"}</p>
                </div>
                <div style={{background:"#F8FAFB",borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:0,fontSize:9,color:"#6B7B8D",fontWeight:600}}>30G DEĞİŞİM</p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:noktalar.length>1&&noktalar[noktalar.length-1].fiyat>noktalar[0].fiyat?"#16A34A":"#DC2626",fontFamily:"monospace"}}>
                    {noktalar.length>1?`${noktalar[noktalar.length-1].fiyat>noktalar[0].fiyat?"+":""}${((noktalar[noktalar.length-1].fiyat-noktalar[0].fiyat)/noktalar[0].fiyat*100).toFixed(1)}%`:"—"}
                  </p>
                  <p style={{margin:"1px 0 0",fontSize:9,color:"#9CA3AF"}}>{noktalar[0]?.tarih} - {noktalar[noktalar.length-1]?.tarih}</p>
                </div>
              </div>

              {degisim&&<div style={{background:pozitif?"#F0FDF4":"#FEF2F2",borderRadius:10,padding:"8px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{pozitif?"📈":"📉"}</span>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:pozitif?"#16A34A":"#DC2626"}}>
                  Günlük Değişim: {pozitif?"+":""}{degisim}%
                </p>
              </div>}

              {/* Grafik */}
              <div style={{background:"#F8FAFB",borderRadius:12,padding:"12px 8px 4px",overflow:"hidden"}}>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",touchAction:"none"}}
                onClick={(e)=>{
                  const rect=(e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                  const x=((e.clientX-rect.left)/rect.width)*W;
                  const idx=Math.round((x-PAD)/(W-PAD*2)*(noktalar.length-1));
                  const i=Math.max(0,Math.min(noktalar.length-1,idx));
                  setTooltip(tooltip?.i===i?null:{i,n:noktalar[i],x:getX(i),y:getY(noktalar[i].fiyat)});
                }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pozitif?"#16A34A":"#DC2626"} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={pozitif?"#16A34A":"#DC2626"} stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[0.25,0.5,0.75].map((r,i)=>(
                    <line key={i} x1={PAD} y1={PAD+(1-r)*(H-PAD*2)} x2={W-PAD} y2={PAD+(1-r)*(H-PAD*2)}
                      stroke="#E5E9F0" strokeWidth="1" strokeDasharray="3,3"/>
                  ))}
                  {/* Area */}
                  <path d={areaD} fill="url(#grad)"/>
                  {/* Line */}
                  <path d={pathD} fill="none" stroke={pozitif?"#16A34A":"#DC2626"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                  {/* Son nokta */}
                  {noktalar.length>0&&(
                    <circle cx={getX(noktalar.length-1)} cy={getY(noktalar[noktalar.length-1].fiyat)}
                      r="4" fill={pozitif?"#16A34A":"#DC2626"} stroke="#fff" strokeWidth="2"/>
                  )}
                  {tooltip&&(
                    <>
                      <line x1={tooltip.x} y1={PAD} x2={tooltip.x} y2={H-PAD} stroke="#1C3A5E" strokeWidth="1" strokeDasharray="3,2"/>
                      <circle cx={tooltip.x} cy={tooltip.y} r="5" fill="#1C3A5E" stroke="#fff" strokeWidth="2"/>
                      <rect x={Math.min(tooltip.x+6,W-90)} y={Math.max(tooltip.y-28,4)} width={84} height={24} rx={5} fill="#1C3A5E"/>
                      <text x={Math.min(tooltip.x+48,W-48)} y={Math.max(tooltip.y-12,18)} textAnchor="middle" fontSize="9" fill="#fff" fontFamily="monospace">{tooltip.n.tarih} {fmt2(tooltip.n.fiyat)}</text>
                    </>
                  )}
                </svg>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0 8px",marginTop:4}}>
                  <span style={{fontSize:9,color:"#9CA3AF"}}>{noktalar[0]?.tarih}</span>
                  <span style={{fontSize:9,color:"#9CA3AF"}}>{noktalar[noktalar.length-1]?.tarih}</span>
                </div>
              </div>
              <p style={{margin:"8px 0 0",fontSize:10,color:"#9CA3AF",textAlign:"center"}}>Kaynak: Yahoo Finance · {etiket} cinsinden</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HakkindaModal({onClose}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid #E5E9F0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:"#1C2B3A"}}>ℹ️ Hakkında</span>
          <button onClick={onClose} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px 32px"}}>
          {/* Geliştirici */}
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"8px 0 16px"}}>
            <div style={{width:60,height:60,borderRadius:30,background:"#1C3A5E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>👨‍💼</div>
            <div>
              <p style={{margin:0,fontSize:17,fontWeight:800,color:"#1C2B3A"}}>Uğur YILMAZ</p>
            </div>
          </div>
          <div style={{height:1,background:"#E5E9F0",marginBottom:14}}/>
          {/* İletişim */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            <a href="mailto:Katilimanalizz@gmail.com" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"#EBF3FB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📧</div>
              <div>
                <p style={{margin:0,fontSize:11,color:"#6B7B8D",fontWeight:600}}>E-Posta</p>
                <p style={{margin:0,fontSize:13,color:"#1C3A5E",fontWeight:700}}>Katilimanalizz@gmail.com</p>
              </div>
            </a>
            <a href="https://www.linkedin.com/in/u%C4%9Fur-yilmaz-62194b168" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"#E8F0FE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💼</div>
              <div>
                <p style={{margin:0,fontSize:11,color:"#6B7B8D",fontWeight:600}}>LinkedIn</p>
                <p style={{margin:0,fontSize:13,color:"#1C3A5E",fontWeight:700}}>Uğur YILMAZ</p>
              </div>
            </a>
          </div>
          <div style={{height:1,background:"#E5E9F0",marginBottom:14}}/>
          {/* Sürüm Notları */}
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:"#1C2B3A"}}>📋 Sürüm Notları</p>
          {[
            {v:"v1.3.0",t:"28 Haziran 2026",notlar:["Esnek ödeme planlarına USD/EUR/komisyon eklendi","Hata & Öneri bildirim sistemi","Vercel Analytics","Geçmiş paylaş aksiyonu","Hakkında ekranı"]},
            {v:"v1.2.0",t:"21 Haziran 2026",notlar:["Ara ödemeli plan bisection algoritması","Canlı altın/gümüş kurları","6 esnek ödeme planı modülü","PDF rapor & Apple Share"]},
            {v:"v1.1.0",t:"15 Haziran 2026",notlar:["Döviz finansmanı (USD/EUR)","POS kârlılık analizi","TM & Akreditif komisyon","Son hesaplamalar geçmişi"]},
            {v:"v1.0.0",t:"1 Haziran 2026",notlar:["İlk yayın","Katılım hesabı & finansman modülleri","Sukuk/kira sertifikası","PWA desteği"]},
          ].map((s,i)=>(
            <div key={i} style={{background:"#F8FAFB",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:800,color:"#1C3A5E"}}>{s.v}</span>
                <span style={{fontSize:10,color:"#9CA3AF"}}>{s.t}</span>
              </div>
              {s.notlar.map((n,j)=>(
                <p key={j} style={{margin:"2px 0",fontSize:11,color:"#6B7B8D"}}>• {n}</p>
              ))}
            </div>
          ))}
          <p style={{margin:"16px 0 0",fontSize:10,color:"#B0B8C8",textAlign:"center"}}>Katılım Analiz © 2026 — Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
}

function BildirimModal({onClose}){
  const [tip,setTip]=useState("hata");
  const [konu,setKonu]=useState("");
  const [mesaj,setMesaj]=useState("");
  const [durum,setDurum]=useState<"idle"|"sending"|"ok"|"err">("idle");

  const gonder=async()=>{
    if(!konu.trim()||!mesaj.trim()) return;
    setDurum("sending");
    try{
      const res=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
        method:"POST",
        headers:{"Content-Type":"application/json","Origin":"https://katilim-analiz.vercel.app"},
        body:JSON.stringify({
          service_id:"service_a8q65p9",
          template_id:"template_ercpb1u",
          user_id:"9tP8nPG0LfoiO6nIA",
          template_params:{
            name:"Katilim Analiz Kullanicisi",
            email:"katilimanalizz@gmail.com",
            title:(tip==="hata"?"[HATA] ":"[ONERI] ")+konu,
            message:"Bildirim Tipi: "+(tip==="hata"?"Hata Bildirimi":"Oneri")+"\nKonu: "+konu+"\n\nMesaj:\n"+mesaj+"\n\nTarih: "+new Date().toLocaleString("tr-TR"),
          }
        })
      });
      if(res.ok) setDurum("ok");
      else setDurum("err");
    }catch(e){
      setDurum("err");
    }
  };

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid #E5E9F0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:"#1C2B3A"}}>📣 Hata & Öneri Bildir</span>
          <button onClick={onClose} style={{background:"#F0F0F0",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>

        {durum==="ok"?(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <p style={{fontSize:18,fontWeight:800,color:"#1A5C4A",margin:"0 0 8px"}}>Bildirim Alındı!</p>
            <p style={{fontSize:14,color:"#6B7B8D",margin:"0 0 24px"}}>Katkılarınız için teşekkür ederiz. En kısa sürede inceleyeceğiz.</p>
            <button onClick={onClose} style={{background:"#1C3A5E",color:"#fff",border:"none",padding:"12px 32px",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer"}}>Kapat</button>
          </div>
        ):durum==="err"?(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>❌</div>
            <p style={{fontSize:16,fontWeight:700,color:"#B83232",margin:"0 0 8px"}}>Gönderilemedi</p>
            <p style={{fontSize:13,color:"#6B7B8D",margin:"0 0 24px"}}>İnternet bağlantınızı kontrol edip tekrar deneyin.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setDurum("idle")} style={{background:"#F0F4F8",color:"#1C2B3A",border:"none",padding:"11px 24px",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>Geri Dön</button>
              <button onClick={gonder} style={{background:"#1C3A5E",color:"#fff",border:"none",padding:"11px 24px",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>Tekrar Dene</button>
            </div>
          </div>
        ):(
          <div style={{flex:1,overflowY:"auto",padding:"16px 18px 8px"}}>
            {/* Tip seçimi */}
            <div style={{display:"flex",background:"#E5E5EA",borderRadius:10,padding:3,marginBottom:16}}>
              {[{v:"hata",l:"🐛 Hata Bildir"},{v:"oneri",l:"💡 Öneri"}].map(o=>(
                <button key={o.v} onClick={()=>setTip(o.v)} style={{
                  flex:1,padding:"9px 4px",borderRadius:8,border:"none",cursor:"pointer",
                  background:tip===o.v?"#fff":"transparent",
                  color:tip===o.v?"#1C2B3A":"#6B7B8D",
                  fontWeight:tip===o.v?700:500,fontSize:13,
                  boxShadow:tip===o.v?"0 1px 4px rgba(0,0,0,0.1)":"none",
                  transition:"all 0.15s"
                }}>{o.l}</button>
              ))}
            </div>

            {/* Konu */}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#6B7B8D",marginBottom:5}}>
                {tip==="hata"?"Hata Konusu":"Öneri Konusu"}
              </label>
              <input value={konu} onChange={e=>setKonu(e.target.value)}
                placeholder={tip==="hata"?"Örn: Konut finansmanı hesaplama hatası":"Örn: Döviz finansmanı eklenmesi"}
                style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",fontSize:14,background:"#F9F9FB",border:"1.5px solid #DDE3EA",borderRadius:10,color:"#1C1C1E",outline:"none"}}/>
            </div>

            {/* Mesaj */}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#6B7B8D",marginBottom:5}}>
                {tip==="hata"?"Hata Detayı":"Öneri Detayı"}
              </label>
              <textarea value={mesaj} onChange={e=>setMesaj(e.target.value)}
                placeholder={tip==="hata"?"Ne yaptınız? Ne olmasını bekliyordunuz? Ne oldu?":"Önerinizi detaylıca açıklayın..."}
                rows={5}
                style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",fontSize:14,background:"#F9F9FB",border:"1.5px solid #DDE3EA",borderRadius:10,color:"#1C1C1E",outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
            </div>
          </div>
        )}

        {durum==="idle"&&(
          <div style={{padding:"12px 18px 32px",flexShrink:0}}>
            <button onClick={gonder} disabled={!konu.trim()||!mesaj.trim()} style={{
              width:"100%",padding:"14px",borderRadius:14,border:"none",
              background:(!konu.trim()||!mesaj.trim())?"#B0B8C8":"#1C3A5E",
              color:"#fff",fontWeight:800,fontSize:15,cursor:(!konu.trim()||!mesaj.trim())?"not-allowed":"pointer"
            }}>
              {tip==="hata"?"🐛 Hata Bildir":"💡 Öneri Gönder"}
            </button>
          </div>
        )}

        {durum==="sending"&&(
          <div style={{padding:"24px",textAlign:"center",flexShrink:0}}>
            <p style={{margin:0,fontSize:14,color:"#6B7B8D"}}>⏳ Gönderiliyor...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function App(){
  const [screen,setScreen]=useState("home");
  const [gecmis,setGecmis]=useState(()=>{
    try{
      const saved=localStorage.getItem("vk_gecmis");
      return saved?JSON.parse(saved):[];
    }catch(e){return [];}
  });
  const [settings,setSettings]=useState(()=>{
    try{
      const saved=localStorage.getItem("vk_settings");
      return saved?{...DEFAULT_SETTINGS,...JSON.parse(saved)}:DEFAULT_SETTINGS;
    }catch(e){return DEFAULT_SETTINGS;}
  });
  const [saved,setSaved]=useState(false);
  const [bildirimAcik,setBildirimAcik]=useState(false);
  const [secilikur,setSeciliKur]=useState<any>(null);
  const [hakkindaAcik,setHakkindaAcik]=useState(false);

  const handleSave=(s)=>{
    setSettings(s);
    try{localStorage.setItem("vk_settings",JSON.stringify(s));}catch(e){}
    setSaved(true);setTimeout(()=>{setSaved(false);setScreen("home");},1200);
  };
  const [saat, setSaat] = useState(()=>new Date());
  useEffect(()=>{
    const t = setInterval(()=>setSaat(new Date()), 1000);
    return ()=>clearInterval(t);
  },[]);

  const [kurlar, setKurlar] = useState([
    {kod:"USD",   try:46.43},
    {kod:"EUR",   try:52.72},
    {kod:"GBP",   try:61.07},
    {kod:"Gümüş (g)", try:88.67, altin:true},
    {kod:"SAR",   try:12.38},
    {kod:"AED",   try:12.64},
    {kod:"100 JPY",try:31.80},
  ]);
  const [kurYuklendi, setKurYuklendi] = useState(false);
  useEffect(()=>{
    const loadKurlar = async () => {
      // Tek API çağrısı - kur.js artık altın ve BTC'yi de içeriyor
      const d = await fetchKurlarViaClaudeAPI();
      const liste:any[] = d ? [
        {kod:"USD",     try: d.USD_TRY},
        {kod:"EUR",     try: d.EUR_TRY},
        {kod:"GBP",     try: d.GBP_TRY},
        {kod:"SAR",     try: d.SAR_TRY},
        {kod:"AED",     try: d.AED_TRY},
        {kod:"100 JPY", try: d.JPY100_TRY},
      ].filter(k=>k.try) : [];

      if(d?.XAU_TRY_gram) liste.push({kod:"Altın (g)",  try:d.XAU_TRY_gram, altin:true});
      if(d?.XAG_TRY_gram) liste.push({kod:"Gümüş (g)",  try:d.XAG_TRY_gram, altin:true});
      if(d?.BTC_USD)       liste.push({kod:"BTC",        try:d.BTC_USD, kripto:true, usd:true});

      if(liste.length>0){
        setKurlar(liste);
        setKurYuklendi(true);
      }
    };
    loadKurlar();
  },[]);

  const saatStr = saat.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const tarihStr = saat.toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  const nav=(sc)=>setScreen(sc);
  const back=()=>{const b=MENU[screen]?.back;if(b)setScreen(b);};
  const meta=MENU[screen];

  const menuItem=(key,icon,title,sub,color,bg,badge)=>(
    <div key={key} onClick={()=>nav(key)} style={{display:"flex",alignItems:"center",gap:14,background:C.card,borderRadius:14,padding:"13px 16px",marginBottom:9,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
      <div style={{width:46,height:46,borderRadius:12,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <p style={{margin:0,fontSize:18,fontWeight:700,color:C.label}}>{title}</p>
        {sub&&<p style={{margin:"2px 0 0",fontSize:12,color:C.sub}}>{sub}</p>}
      </div>
      {badge&&<span style={{background:color,color:"#fff",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:700}}>{badge}</span>}
      <span style={{color:C.sep,fontSize:20}}>›</span>
    </div>
  );

  return(
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif",background:C.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto"}}>
      {/* header */}
      <div style={{background:"#0F1923",padding:"44px 20px 20px",position:"sticky",top:0,zIndex:50}}>
        {screen==="home"?(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{display:"flex",gap:6,marginBottom:4}}>
                  <div onClick={()=>setBildirimAcik(true)} style={{flex:1,background:"rgba(255,193,7,0.2)",border:"1px solid rgba(255,193,7,0.6)",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>
                    <p style={{margin:0,fontSize:10,fontWeight:700,color:"#FFD60A",textAlign:"center"}}>⚠️ TEST AŞAMASINDADIR</p>
                    <p style={{margin:"2px 0 0",fontSize:9,color:"rgba(255,255,255,0.7)",textAlign:"center"}}>Hata ve önerilerinizi buradan bildirebilirsiniz</p>
                  </div>
                  <div style={{flex:1,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px"}}>
                    <p style={{margin:0,fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.9)",textAlign:"center"}}>📋 YASAL UYARI</p>
                    <p style={{margin:"2px 0 0",fontSize:9,color:"rgba(255,255,255,0.65)",textAlign:"center",lineHeight:1.3}}>Bilgilendirme amaçlıdır, hukuki sonuç doğurmaz</p>
                  </div>
                </div>
                <p style={{margin:"3px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>Finans Analiz Platformu</p>
              </div>
              <button onClick={()=>nav("ayarlar")} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",width:38,height:38,borderRadius:10,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>⚙️</button>
            </div>
            {/* Tarih & Saat */}
            <div style={{background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.6)",textTransform:"capitalize"}}>{tarihStr}</p>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:"#fff",fontFamily:"monospace",letterSpacing:"0.05em"}}>{saatStr}</p>
            </div>

            {/* Kur Ticker */}
            <div style={{overflow:"hidden",borderRadius:8,background:"rgba(0,0,0,0.25)",padding:"5px 0",position:"relative"}}>
              {!kurYuklendi&&<div style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",fontSize:9,color:"rgba(255,255,0,0.6)",fontWeight:700,zIndex:2}}>⏳</div>}
              <style>{`
                @keyframes ticker {
                  0%   { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                .ticker-inner {
                  display: inline-flex;
                  animation: ticker 28s linear infinite;
                  white-space: nowrap;
                }
              `}</style>
              <div className="ticker-inner">
                {[...kurlar,...kurlar].map((k,i)=>(
                  <span key={i} onClick={()=>setSeciliKur(k)} style={{
                    display:"inline-flex",alignItems:"center",gap:4,
                    marginRight:28,fontSize:11,fontWeight:600,
                    color:"rgba(255,255,255,0.85)",cursor:"pointer"
                  }}>
                    <span style={{color:"rgba(255,255,255,0.45)",fontSize:10}}>{k.altin ? k.kod : k.kripto ? k.kod+"/USD" : k.kod+"/TRY"}</span>
                    <span style={{color:kurYuklendi?(k.kripto?"#F7931A":k.altin?"#FFD60A":"#4ADE80"):"rgba(255,255,100,0.7)",fontFamily:"monospace"}}>{typeof k.try==="number"?(k.kripto?"$"+fmtN(k.try,0):fmtN(k.try,2)):k.try}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={back} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",fontWeight:600,fontSize:15,cursor:"pointer",padding:"8px 14px",borderRadius:10}}>‹ Geri</button>
            <span style={{fontSize:16,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{meta?.title}</span>
          </div>
        )}
      </div>

      {bildirimAcik&&<BildirimModal onClose={()=>setBildirimAcik(false)}/>}
      {secilikur&&<KurGrafikModal kur={secilikur} onClose={()=>setSeciliKur(null)}/>}
      {hakkindaAcik&&<HakkindaModal onClose={()=>setHakkindaAcik(false)}/>}
      {saved&&<div style={{position:"fixed",top:64,left:"50%",transform:"translateX(-50%)",background:"#1C3A5E",color:"#fff",borderRadius:20,padding:"10px 20px",fontSize:14,fontWeight:600,zIndex:100}}>✓ Ayarlar kaydedildi</div>}

      <div style={{paddingTop:0}}>

        {/* ── HOME ── */}
        {screen==="home"&&(
          <div style={{background:"#0F1923",height:"calc(100vh - 112px)",padding:"8px 10px 0",boxSizing:"border-box",display:"flex",flexDirection:"column",position:"relative",overflowY:"auto"}}>
            {/* Ana grid — 8 kart, 4 satır */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              {[
                {key:"katilimMenu",        icon:"🏦", label:"Katılım Fonu\nHesaplama Araçları", count:"7 Araç", g1:"#1C3A5E",g2:"#2C5282"},
                {key:"finansmanMenu",      icon:"💳", label:"Bireysel\nFinansman Araçları",      count:"6 Araç", g1:"#1A5C4A",g2:"#2A7A62"},
                {key:"ticariMenu",         icon:"🏢", label:"Tüzel\nFinansman Araçları",         count:"7 Araç", g1:"#7A5000",g2:"#B07D2E"},
                {key:"finansalTakvim",     icon:"📅", label:"Finansal\nTakvim",                  count:"",       g1:"#4A3080",g2:"#6B4FA0"},
                {key:"finansalGostergeler",icon:"📊", label:"Finansal\nGöstergeler",              count:"",       g1:"#7A1A40",g2:"#9C3060"},
                {key:"fonGetiriIzleme",    icon:"📈", label:"Fon Getiri\nİzleme ve Hesaplama",   count:"",       g1:"#1A4A3A",g2:"#2A7A5A"},
                {key:"asistan",            icon:"🤖", label:"VK\nAsistan",                        count:"",       g1:"#1A4A2A",g2:"#2A6A3A"},
                {key:"sozluk",             icon:"📖", label:"Katılım\nBankacılığı Sözlüğü",      count:"",       g1:"#2C4A6E",g2:"#1A3A5E"},
              ].map((c,i)=>(
                <div key={i} onClick={()=>nav(c.key)} style={{
                  background:`linear-gradient(145deg,${c.g1} 0%,${c.g2} 100%)`,
                  borderRadius:18, cursor:"pointer", position:"relative", overflow:"hidden",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  textAlign:"center", minHeight:90, boxShadow:`0 4px 16px ${c.g1}88`,
                }}>
                  <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:40,background:"rgba(255,255,255,0.07)"}}/>
                  <div style={{fontSize:18,marginBottom:3,position:"relative"}}>{c.icon}</div>
                  <p style={{margin:"0 0 4px",fontSize:16,fontWeight:800,color:"#fff",lineHeight:1.2,whiteSpace:"pre-line",position:"relative",padding:"0 4px"}}>{c.label}</p>
                  {c.count&&(
                    <div style={{display:"inline-flex",background:"rgba(255,255,255,0.18)",borderRadius:20,padding:"4px 12px",position:"relative"}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,0.9)",fontWeight:700}}>{c.count}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Son Hesaplamalar — tam genişlik */}
            <div onClick={()=>nav("gecmis")} style={{
              background:"linear-gradient(145deg,#3D1A5C 0%,#5A2E8A 100%)",
              borderRadius:18, cursor:"pointer", padding:"14px 20px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              boxShadow:"0 4px 16px #3D1A5C88", marginBottom:8,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>🕐</span>
                <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>Son Hesaplamalar</span>
              </div>
              <span style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>›</span>
            </div>

            {/* Hakkında + Copyright */}
            <div onClick={()=>setHakkindaAcik(true)} style={{
              padding:"10px 16px",
              background:"rgba(255,255,255,0.04)",
              borderRadius:14,
              cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:8,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16}}>👨‍💼</span>
                <div>
                  <p style={{margin:0,fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.9)"}}>Hakkında</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"rgba(255,255,255,0.35)"}}>Uğur YILMAZ · v1.3.0 · Sürüm Notları</p>
                </div>
              </div>
              <span style={{fontSize:14,color:"rgba(255,255,255,0.3)"}}>›</span>
            </div>
            <p style={{margin:"0 0 12px",fontSize:10,color:"rgba(255,255,255,0.18)",textAlign:"center",letterSpacing:0.3}}>
              © 2026 Katılım Analiz · Tüm hakları saklıdır.
            </p>
          </div>
        )}


{/* ── KATILIM MENU ── */}
        {screen==="katilimMenu"&&(
          <div style={{padding:"0 16px 32px"}}>
            {menuItem("vadeliKatilim","💰","Katılım Hesabı Getiri Hesaplama","",C.blue,C.blueLight)}
            {menuItem("getiridenAnapara","🎯","Getiriden Anapara Hesaplama","",C.blue,C.blueLight)}
            {menuItem("oranAnalizi","📊","Günlük Hesap Oran Hesaplama","",C.purple,C.purpleLight)}
            {menuItem("tahvilBono","📈","Sukuk Kira Sertifikası Getiri Hesaplama","",C.teal,C.tealLight)}
            {menuItem("kasaOranAnalizi","🔄","Kasa Hesabı Oran Analizi","",C.teal,C.tealLight)}
            {menuItem("verimlilikAnalizi","📐","Verimlilik Analizi","",C.green,C.greenLight)}
            {menuItem("fonGetiriIzleme","📈","Fon Getiri İzleme ve Hesaplama","",C.blue,C.blueLight)}
          </div>
        )}

        {screen==="finansmanMenu"&&(
          <div style={{padding:"0 16px 32px"}}>
            {menuItem("konutFinansman","🏠","Konut Finansmanı Hesaplama","",C.green,C.greenLight)}
            {menuItem("tasitFinansman","🚗","Taşıt Finansmanı Hesaplama","",C.teal,C.tealLight)}
            {menuItem("yatirimFonuFinansman","📦","Yatırım Fonu Finansmanı Hesaplama","",C.purple,C.purpleLight)}
            {menuItem("toggFinansman","🚗","Togg Finansmanı Hesaplama","",C.teal,C.tealLight)}
            {menuItem("arsaIsyeri","🏢","Arsa/İşyeri Finansmanı Hesaplama","",C.orange,C.orangeLight)}
            {menuItem("taksitenKredi","🔢","Taksitten Tutar Hesaplama","",C.orange,C.orangeLight)}
          </div>
        )}

        {/* ── TİCARİ FİNANSMAN MENU ── */}
        {screen==="ticariMenu"&&(
          <div style={{padding:"0 16px 32px"}}>
            {menuItem("spotFinansman","⚡","Spot Finansman Hesaplama","",C.orange,C.orangeLight)}
            {menuItem("taksitliTicari","🏢","Taksitli Ticari Finansman Hesaplama","",C.blue,C.blueLight)}
            {menuItem("esnekOdemePlanlari","📊","Esnek Ödeme Planları Hesaplama","",C.green,C.greenLight)}
            {menuItem("leasing","🚙","Finansal Kiralama Hesaplama","",C.teal,C.tealLight)}
            {menuItem("posHesaplama","💳","POS Komisyon Hesaplama","",C.purple,C.purpleLight)}
            {menuItem("tmKomisyon","📋","TM Komisyon Hesaplama","",C.purple,C.purpleLight)}
            {menuItem("akreditifKomisyon","🏦","Akreditif Komisyon Hesaplama","",C.blue,C.blueLight)}
          </div>
        )}

        {/* ── EKRANLAR ── */}
        {screen==="vadeliKatilim"&&<VadeliKatilim s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="kasaOranAnalizi"&&<KasaOranAnalizi/>}
        {screen==="verimlilikAnalizi"&&<VerimlilikAnalizi s={settings}/>
        }
        {screen==="fonGetiriIzleme"&&<FonGetiriIzleme settings={settings}/>}
        {screen==="getiridenAnapara"&&<GetiridenAnapara s={settings}/>}
        {screen==="oranAnalizi"&&<OranAnalizi s={settings}/>}
        {screen==="tahvilBono"&&<TahvilBono s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="konutFinansman"&&<KonutFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="tasitFinansman"&&<TasitFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="yatirimFonuFinansman"&&<YatirimFonuFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="toggFinansman"&&<ToggFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="arsaIsyeri"&&<ArsaIsyeriFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="taksitenKredi"&&<TaksitenKredi s={settings}/>}
        {screen==="spotFinansman"&&<SpotKredi s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="taksitliTicari"&&<TaksitliTicariFinansman s={settings}/>}
        {screen==="leasing"&&<Leasing s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="posHesaplama"&&<PosHesaplama s={settings}/>}
        {screen==="tmKomisyon"&&<TmKomisyon/>}
        {screen==="akreditifKomisyon"&&<AkreditifKomisyon/>}
        {screen==="esnekOdemePlanlari"&&<EsnekOdemePlanlari nav={nav}/>}
        {screen==="esitAnapara"&&<EsitAnapara onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="araOdemeli"&&<AraOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="artanOdemeli"&&<ArtanOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="azalanOdemeli"&&<AzalanOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="balonOdemeli"&&<BalonOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="esnekOdemeli"&&<EsnekOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="asistan"&&<Asistan nav={nav}/>}
        {screen==="sozluk"&&<Sozluk/>}
        {screen==="gecmis"&&<Gecmis gecmis={gecmis} onTemizle={()=>{setGecmis([]);try{localStorage.removeItem("vk_gecmis")}catch(e){}}} nav={nav}/>}
        {screen==="finansalTakvim"&&<FinansalTakvim/>}
        {screen==="finansalGostergeler"&&<FinansalGostergeler onKurTikla={(k:any)=>setSeciliKur(k)}/>}
        {screen==="ayarlar"&&<Ayarlar settings={settings} onSave={handleSave}/>}

        {/* ── YASAL UYARI FOOTER ── */}
        {!["home","katilimMenu","finansmanMenu","ticariMenu","asistan","sozluk","finansalTakvim","finansalGostergeler","ayarlar"].includes(screen)&&(
          <div style={{
            margin:"4px 16px 28px",
            padding:"10px 14px",
            background:"#F5F6F8",
            borderRadius:10,
            borderLeft:`3px solid #B0B8C8`,
            display:"flex",gap:8,alignItems:"flex-start"
          }}>
            <span style={{fontSize:13,flexShrink:0,marginTop:1}}>⚠️</span>
            <p style={{
              margin:0,
              fontSize:11,
              color:"#6B7280",
              lineHeight:1.55,
              fontStyle:"italic"
            }}>
              Bu hesaplamalar yalnızca bilgilendirme amaçlıdır; kesin teklif, resmi belge veya hukuki taahhüt niteliği taşımaz. Nihai oranlar ve koşullar için yetkili biriminizle iletişime geçiniz.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
