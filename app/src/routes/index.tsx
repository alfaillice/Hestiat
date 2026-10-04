import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Compass, Heart, Menu, Search, SlidersHorizontal, X } from "lucide-react";
import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { getVisitorLocale, type Locale } from "@/lib/locale";
import { text } from "@/lib/copy";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";

const stays=[
 {id:"valencia",city:"Valencia",type:"Apartamento",price:135,image:"/assets/stays/valencia.png",tag:"coast"},
 {id:"mallorca",city:"Mallorca",type:"Finca",price:168,image:"/assets/stays/mallorca.png",tag:"nature"},
 {id:"madrid",city:"Madrid",type:"Apartamento",price:119,image:"/assets/stays/madrid.png",tag:"city"},
];

export const Route=createFileRoute("/")({loader:async()=>({locale:await getVisitorLocale()}),component:Index});

function Index(){
 const {locale:initialLocale}=Route.useLoaderData();
 const [locale,setLocale]=useState<Locale>(initialLocale);
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState("all");
 const [menuOpen,setMenuOpen]=useState(false);
 const t=text(locale);
 useEffect(()=>{document.documentElement.lang=locale},[locale]);
 const visible=useMemo(()=>stays.filter(s=>(filter==="all"||s.tag===filter)&&(!query||`${s.city} ${s.type}`.toLowerCase().includes(query.toLowerCase()))),[filter,query]);
 const heroScene={...scrollScrubScenes[0],kicker:t.atlas,title:t.heroTitle,body:t.footer,tags:[t.stay,t.exp,t.service]};
 const experience=[t.exp1,t.exp2,t.exp3], services=[t.serv1,t.serv2,t.serv3];
 return <main className="hestiat-page">
  <header className="site-nav">
   <a className="brand-lockup" href="#top" aria-label="Hestiat"><img src="/assets/brand/hestiat-mark.png" alt=""/><span>hestiat</span></a>
   <nav className="desktop-nav"><a href="#stays">{t.stay}</a><a href="#experiences">{t.exp}</a><a href="#services">{t.service}</a><a href="#host">{t.host}</a></nav>
   <div className="nav-actions"><label className="language-picker" title={t.lang}><span>{locale.toUpperCase()}</span><ChevronDown size={14}/><select value={locale} onChange={e=>setLocale(e.target.value as Locale)} aria-label={t.lang}>{["es","en","nl","fr","de","it","pt"].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label><button className="menu-trigger" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label="Menu">{menuOpen?<X size={21}/>:<Menu size={21}/>}</button></div>
  </header>
  {menuOpen&&<div className="mobile-menu"><a href="#stays" onClick={()=>setMenuOpen(false)}>{t.stay}</a><a href="#experiences" onClick={()=>setMenuOpen(false)}>{t.exp}</a><a href="#services" onClick={()=>setMenuOpen(false)}>{t.service}</a><a href="#host" onClick={()=>setMenuOpen(false)}>{t.host}</a></div>}

  <section id="top" className="journey-shell">
   <ScrollScrub scenes={[heroScene]} theme={scrollScrubTheme}/>
   <div className="hero-search-wrap">
    <div className="hero-search-copy"><span className="route-mark"><Compass size={15}/> HESTIAT</span><h1>{t.search}</h1><p>{t.hint}</p></div>
    <form className="hero-search" onSubmit={e=>{e.preventDefault();document.getElementById("stays")?.scrollIntoView({behavior:"smooth"})}}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.hint} aria-label={t.hint}/><button type="submit">{t.find}<ArrowUpRight size={16}/></button></form>
   </div>
  </section>

  <section id="stays" className="content-section stays-section">
   <div className="section-heading"><div><p className="mono-label">01</p><h2>{t.selected}</h2></div><p>{t.selectedText}</p></div>
   <div className="filter-row">{[["all",t.all],["coast",t.coast],["city",t.city],["nature",t.nature]].map(([value,label])=><button key={value} className={filter===value?"filter-active":"filter-link"} onClick={()=>setFilter(value)}>{label}</button>)}<span className="filter-spacer"/><span className="results-note"><SlidersHorizontal size={15}/>{visible.length}</span></div>
   <div className="stay-grid">{visible.map((stay,i)=><article className={`stay-card stay-${i+1}`} key={stay.id}><div className="stay-image-wrap"><img src={stay.image} alt={`${stay.type} in ${stay.city}`}/><button className="heart-button" aria-label={`Save ${stay.city}`}><Heart size={18}/></button></div><div className="stay-info"><div><p className="stay-city">{stay.city}</p><h3>{stay.type}</h3></div><div className="stay-price"><strong>{stay.price} €</strong><span>/{t.night}</span></div></div><a href="#host" className="stay-route">{t.find}<ArrowUpRight size={15}/></a></article>)}</div>
   {!visible.length&&<div className="empty-state">{t.search}</div>}
  </section>

  <section id="experiences" className="content-section experience-section"><div className="experience-intro"><p className="mono-label">02</p><h2>{t.more}</h2><p>{t.moreText}</p></div><div className="experience-list">{experience.map((item,i)=><a href="#services" className="experience-row" key={item}><span>0{i+1}</span><strong>{item}</strong><ArrowUpRight size={18}/></a>)}</div></section>

  <section id="services" className="content-section service-section"><div className="service-title"><p className="mono-label">03</p><h2>{t.servicesTitle}</h2></div><div className="service-copy"><p>{t.servicesText}</p>{services.map((item,i)=><div className="service-line" key={item}><span>0{i+1}</span><strong>{item}</strong></div>)}</div></section>

  <section className="content-section how-section"><div className="how-intro"><p className="mono-label">04</p><h2>{t.how}</h2></div><div className="steps">{[[t.step1,t.step1Text],[t.step2,t.step2Text],[t.step3,t.step3Text]].map(([title,body],i)=><article className="step" key={title}><span>0{i+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>

  <section id="host" className="host-section"><div className="host-mark"><img src="/assets/brand/hestiat-mark.png" alt=""/></div><div><p className="mono-label">HESTIAT / HOST</p><h2>{t.hostTitle}</h2><p>{t.hostText}</p></div><a className="host-cta" href="mailto:hosts@hestiat.com">{t.hostCta}<ArrowUpRight size={18}/></a></section>
  <footer className="site-footer"><div className="footer-brand"><img src="/assets/brand/hestiat-mark.png" alt=""/><strong>hestiat</strong><p>{t.footer}</p></div><div className="footer-links"><a href="#stays">{t.stay}</a><a href="#experiences">{t.exp}</a><a href="#services">{t.service}</a><a href="#host">{t.host}</a></div><small>© 2026 Hestiat</small></footer>
 </main>
}
