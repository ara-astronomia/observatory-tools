// ═══════════════════════════════════════════════════════════════
// astro-utils.js — Funzioni astronomiche condivise
// JD, GMST, Alt/Az, Sole, Luna (Meeus cap.47), Twilight
// ═══════════════════════════════════════════════════════════════

const D2R=Math.PI/180,R2D=180/Math.PI;

function parseRA(s){s=s.trim();if(/[\s:h]/.test(s)){const p=s.split(/[\s:h]+/).map(Number);return p[0]+(p[1]||0)/60+(p[2]||0)/3600;}return parseFloat(s);}
function parseDec(s){s=s.trim();const neg=s.startsWith('-');if(/[\s:°d]/.test(s)){const p=s.replace(/[°'"d]/g,' ').trim().split(/[\s:]+/).map(v=>Math.abs(parseFloat(v))||0);const v=p[0]+(p[1]||0)/60+(p[2]||0)/3600;return neg?-v:v;}return parseFloat(s);}
function jd(date){const y=date.getUTCFullYear(),m=date.getUTCMonth()+1,d=date.getUTCDate(),h=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600;return 367*y-Math.floor(7*(y+Math.floor((m+9)/12))/4)+Math.floor(275*m/9)+d+1721013.5+h/24;}
function gmst(J){const T=(J-2451545)/36525;return(((280.46061837+360.98564736629*(J-2451545)+0.000387933*T*T-T*T*T/38710000)%360)+360)%360;}
function altaz(rh,dd,lat,lon,J){const ha=((gmst(J)+lon-rh*15)%360+360)%360,H=ha*D2R,d=dd*D2R,L=lat*D2R;const sinA=Math.sin(d)*Math.sin(L)+Math.cos(d)*Math.cos(L)*Math.cos(H);const alt=Math.asin(Math.max(-1,Math.min(1,sinA)))*R2D;const cosZ=(-Math.sin(d)*Math.cos(L)+Math.cos(d)*Math.sin(L)*Math.cos(H))/Math.cos(alt*D2R);let az=Math.acos(Math.max(-1,Math.min(1,cosZ)))*R2D;if(Math.sin(H)>0)az=360-az;return{alt,az};}
function sunPos(J){const T=(J-2451545)/36525,L0=280.46646+36000.76983*T,M=(357.52911+35999.05029*T)*D2R,C=(1.914602-0.004817*T)*Math.sin(M)+(0.019993-0.000101*T)*Math.sin(2*M),lon=(L0+C)*D2R,e=(23.439291-0.013004*T)*D2R;return{ra_h:((Math.atan2(Math.cos(e)*Math.sin(lon),Math.cos(lon))*R2D+360)%360)/15,dec_d:Math.asin(Math.sin(e)*Math.sin(lon))*R2D};}
function sunAlt(J,lat,lon){const s=sunPos(J);return altaz(s.ra_h,s.dec_d,lat,lon,J).alt;}
function moonPos(J){
  const T=(J-2451545)/36525,r=D2R;
  const L0=218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841;
  const D=297.8501921+445267.1114034*T-0.0018819*T*T+T*T*T/545868;
  const M=357.5291092+35999.0502909*T-0.0001536*T*T;
  const Mp=134.9633964+477198.8675055*T+0.0087414*T*T+T*T*T/69699;
  const F=93.2720950+483202.0175233*T-0.0036539*T*T;
  const A1=119.75+131.849*T,A2=53.09+479264.290*T,E=1-0.002516*T-0.0000074*T*T;
  let sL=6288774*Math.sin(Mp*r)+1274027*Math.sin((2*D-Mp)*r)+658314*Math.sin(2*D*r)+213618*Math.sin(2*Mp*r)-185116*E*Math.sin(M*r)-114332*Math.sin(2*F*r)+58793*Math.sin((2*D-2*Mp)*r)+57066*E*Math.sin((2*D-M-Mp)*r)+53322*Math.sin((2*D+Mp)*r)+45758*E*Math.sin((2*D-M)*r)-40923*E*Math.sin((M-Mp)*r)-34720*Math.sin(D*r)-30383*E*Math.sin((M+Mp)*r)+15327*Math.sin((2*D-2*F)*r)+10980*Math.sin((Mp-2*F)*r)+10675*Math.sin((4*D-Mp)*r)+10034*Math.sin(3*Mp*r)+3958*Math.sin(A1*r)+1962*Math.sin((L0-F)*r)+318*Math.sin(A2*r);
  let sB=5128122*Math.sin(F*r)+280602*Math.sin((Mp+F)*r)+277693*Math.sin((Mp-F)*r)+173237*Math.sin((2*D-F)*r)+55413*Math.sin((2*D-Mp+F)*r)+46271*Math.sin((2*D-Mp-F)*r)+32573*Math.sin((2*D+F)*r)+17198*Math.sin((2*Mp+F)*r)+9266*Math.sin((2*D+Mp-F)*r)+8822*Math.sin((2*Mp-F)*r)-8216*E*Math.sin((2*D-M-F)*r)-4324*Math.sin((2*D-2*Mp-F)*r)-4200*Math.sin((2*D+Mp+F)*r);
  const lambda=((L0+sL/1e6)%360+360)%360,beta=sB/1e6;
  const eps=(23.439291-0.013004*T)*D2R,lam=lambda*D2R,bet=beta*D2R;
  const ra_h=((Math.atan2(Math.sin(lam)*Math.cos(eps)-Math.tan(bet)*Math.sin(eps),Math.cos(lam))*R2D+360)%360)/15;
  const dec_d=Math.asin(Math.sin(bet)*Math.cos(eps)+Math.cos(bet)*Math.sin(eps)*Math.sin(lam))*R2D;
  return{ra_h,dec_d,lambda};
}
function moonIllum(J){const mn=moonPos(J),su=sunPos(J);const el=Math.acos(Math.max(-1,Math.min(1,Math.sin(su.dec_d*D2R)*Math.sin(mn.dec_d*D2R)+Math.cos(su.dec_d*D2R)*Math.cos(mn.dec_d*D2R)*Math.cos((mn.ra_h-su.ra_h)*15*D2R))))*R2D;const illum=Math.round((1-Math.cos(el*D2R))/2*100);const phase=((mn.lambda-su.ra_h*15-180)%360+360)%360/360;return{illum,elong:Math.round(el),phase};}
function phaseIcon(p){if(p<0.03||p>0.97)return'🌑';if(p<0.22)return'🌒';if(p<0.28)return'🌓';if(p<0.47)return'🌔';if(p<0.53)return'🌕';if(p<0.72)return'🌖';if(p<0.78)return'🌗';return'🌘';}
function phaseName(p){if(p<0.03||p>0.97)return'Luna Nuova';if(p<0.22)return'Falce cresc.';if(p<0.28)return'Primo Quarto';if(p<0.47)return'Gibbosa cresc.';if(p<0.53)return'Luna Piena';if(p<0.72)return'Gibbosa cal.';if(p<0.78)return'Ultimo Quarto';return'Falce cal.';}
function angDist(r1,d1,r2,d2){const c=Math.sin(d1*D2R)*Math.sin(d2*D2R)+Math.cos(d1*D2R)*Math.cos(d2*D2R)*Math.cos((r1-r2)*15*D2R);return Math.acos(Math.max(-1,Math.min(1,c)))*R2D;}
function findTwilight(date,lat,lon,tz){const base=new Date(date);base.setHours(12,0,0,0);const jdN=jd(base)-tz/24;const thr=-18;let ss=null,sr=null;for(let h=12;h<=30;h+=0.05){const J=jdN+(h-12)/24;if(sunAlt(J,lat,lon)<thr&&sunAlt(J-0.05/24,lat,lon)>=thr){ss=h;break;}}for(let h=18;h<=36;h+=0.05){const J=jdN+(h-12)/24;if(sunAlt(J,lat,lon)>=thr&&sunAlt(J-0.05/24,lat,lon)<thr){sr=h;break;}}return{sunset:ss||18,sunrise:sr||30};}

// ══════════════════════════════════════════════════════════════════
// STARALT
// ══════════════════════════════════════════════════════════════════