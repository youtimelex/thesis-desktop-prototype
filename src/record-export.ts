/** Local material export. Never fabricates audio or sends content to a server. */
export type ExportFormat = 'docx' | 'html' | 'md' | 'pdf' | 'txt';
export type SummaryExportInput = { title: string; summary: string; notice?: string | null };
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const escape = (s: string) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const exportFileName = (title: string) => (title.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 140) || 'Резюме');
/** Plain-text fallback preserves link destinations and never interprets raw HTML. */
export function plainMarkdown(text: string): string {
 return clean(text).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/^\s*>\s?/gm, '').replace(/^\s*```[^\n]*$/gm, '');
}
export function buildMarkdown(input: SummaryExportInput): string { return ['# ' + clean(input.title), input.notice ? clean(input.notice) : '', clean(input.summary)].filter(Boolean).join('\n\n') + '\n'; }
export function buildPlainText(input: SummaryExportInput): string { return [clean(input.title), input.notice ? clean(input.notice) : '', plainMarkdown(input.summary)].filter(Boolean).join('\n\n') + '\n'; }
type Block = { text: string; kind: 'heading'|'paragraph'|'bullet'|'quote'|'code'; level?: number };
function blocks(markdown: string): Block[] {
 const result: Block[] = []; let code = false;
 for (const line of clean(markdown).split(/\r?\n/)) {
  if (/^\s*```/.test(line)) { code = !code; continue; }
  if (!line.trim()) continue;
  if (code) { result.push({kind:'code',text:line}); continue; }
  const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
  if (heading) result.push({kind:'heading',level:heading[1].length,text:heading[2]});
  else if (/^\s*[-*+]\s+/.test(line)) result.push({kind:'bullet',text:line.replace(/^\s*[-*+]\s+/, '')});
  else if (/^\s*>\s?/.test(line)) result.push({kind:'quote',text:line.replace(/^\s*>\s?/, '')});
  else result.push({kind:'paragraph',text:line});
 }
 return result;
}
// Escape first: user-supplied tags/attributes are text, never executable markup.
function inlineHTML(text: string): string { return escape(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>'); }
export function buildHTML(input: SummaryExportInput): string {
 const body=blocks(input.summary).map(b=>b.kind==='heading'?`<h${Math.min((b.level??1)+1,6)}>${inlineHTML(b.text)}</h${Math.min((b.level??1)+1,6)}>`:b.kind==='bullet'?`<p class="bullet">• ${inlineHTML(b.text)}</p>`:b.kind==='quote'?`<blockquote>${inlineHTML(b.text)}</blockquote>`:b.kind==='code'?`<pre>${escape(b.text)}</pre>`:`<p>${inlineHTML(b.text)}</p>`).join('\n');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(input.title)}</title><style>body{font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#15171a;background:white;max-width:800px;margin:40px auto;padding:0 24px}h1{font-size:28px;line-height:1.2}h2{font-size:22px}h3{font-size:18px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}.notice{color:#555;border-left:3px solid #888;padding-left:12px}.bullet{padding-left:18px;text-indent:-14px}blockquote{border-left:3px solid #ccc;margin:16px 0;padding-left:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere}code,pre{font-family:monospace}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;max-width:none}h1,h2,h3{break-after:avoid}p{orphans:3;widows:3}}</style></head><body><h1>${escape(input.title)}</h1>${input.notice?`<p class="notice">${escape(input.notice)}</p>`:''}${body}</body></html>`;
}
const encoder=new TextEncoder();
function crc32(bytes: Uint8Array) { let crc=0xffffffff; for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0; }
/** ZIP store mode, UTF-8 names. OOXML readers support uncompressed ZIP members. */
function zip(entries: {name:string;content:string}[]): Uint8Array<ArrayBuffer> {
 const files: Uint8Array[]=[];const directory: Uint8Array[]=[];let offset=0;
 for(const entry of entries){
  const name=encoder.encode(entry.name),data=encoder.encode(entry.content),crc=crc32(data);
  const header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);
  const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,0x21,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);
  files.push(header,data);directory.push(central);offset+=header.length+data.length;
 }
 const dirSize=directory.reduce((s,b)=>s+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,dirSize,true);ev.setUint32(16,offset,true);
 const output=new Uint8Array(offset+dirSize+22);let pos=0;for(const bytes of [...files,...directory,end]){output.set(bytes,pos);pos+=bytes.length;}return output;
}
function wordParagraph(text:string,kind:Block['kind']|'title',level=1):string {
 const heading=kind==='title'||kind==='heading';const fontSize=kind==='title'?36:heading?Math.max(24,32-level*2):22;
 const prefix=kind==='bullet'?'• ':'';
 return `<w:p><w:pPr><w:spacing w:after="160"/>${heading?'<w:keepNext/>':''}${kind==='bullet'?'<w:ind w:left="360" w:hanging="240"/>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${heading?'<w:b/>':''}${kind==='quote'?'<w:i/>':''}<w:sz w:val="${fontSize}"/></w:rPr><w:t xml:space="preserve">${escape(prefix+plainMarkdown(text))}</w:t></w:r></w:p>`;
}
export function buildDocx(input:SummaryExportInput):Uint8Array<ArrayBuffer> {
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const body=wordParagraph(input.title,'title')+(input.notice?wordParagraph(input.notice,'quote'):'')+blocks(input.summary).map(b=>wordParagraph(b.text,b.kind,b.level)).join('');
 return zip([
  {name:'[Content_Types].xml',content:xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
  {name:'_rels/.rels',content:xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
  {name:'word/document.xml',content:xml+`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020"/></w:sectPr></w:body></w:document>`},
 ]);
}
export function buildExportBlob(input:SummaryExportInput,format:Exclude<ExportFormat,'pdf'>):Blob {
 switch(format){case 'docx':return new Blob([buildDocx(input)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});case 'html':return new Blob([buildHTML(input)],{type:'text/html;charset=utf-8'});case 'md':return new Blob([buildMarkdown(input)],{type:'text/markdown;charset=utf-8'});case 'txt':return new Blob([buildPlainText(input)],{type:'text/plain;charset=utf-8'});}
}
/** PDF opens the browser print flow. The caller must not claim a PDF was saved. */
export async function exportSummary(input:SummaryExportInput,format:ExportFormat):Promise<'download'|'print'> {
 if(format==='pdf'){
  const popup=window.open('','_blank');
  if(!popup)throw new Error('Разрешите открытие окна печати для этого сайта и повторите экспорт PDF.');
  popup.opener=null;popup.document.open();popup.document.write(buildHTML(input));popup.document.close();
  popup.focus();setTimeout(()=>{if(!popup.closed)popup.print();},200);return 'print';
 }
 const blob=buildExportBlob(input,format),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${exportFileName(input.title)}.${format.toLowerCase()}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return 'download';
}
