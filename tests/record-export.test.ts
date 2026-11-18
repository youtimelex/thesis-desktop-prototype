import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDocx,buildHTML,buildMarkdown,buildPlainText,buildExportBlob,exportFileName} from '../src/record-export.ts';
const input={title:'Резюме: встреча / 14 ноября',notice:'Резюме не обновлено.',summary:'## Решения\n- **Проверить** русский текст & кавычки\n\n<script>alert(1)</script>\n[ссылка](https://example.org)'};
test('exports preserve Unicode content and stale-material notice',()=>{
 assert.match(buildMarkdown(input),/## Решения/);assert.match(buildPlainText(input),/Проверить русский текст/);assert.match(buildPlainText(input),/Резюме не обновлено\./);assert.equal(exportFileName(input.title),'Резюме- встреча - 14 ноября');
});
test('HTML export never executes source markup',()=>{
 const html=buildHTML(input);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.ok(!html.includes('<script>'));assert.match(buildHTML({...input,title:'<img src=x onerror=alert(1)>'}),/&lt;img/);
});
test('DOCX is an actual OOXML ZIP and retains its main document content',()=>{
 const bytes=buildDocx(input),view=new DataView(bytes.buffer);assert.equal(view.getUint32(0,true),0x04034b50);let offset=0;const entries=new Map<string,string>();
 while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);const name=new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength));const start=offset+30+nameLength+extraLength;entries.set(name,new TextDecoder().decode(bytes.slice(start,start+size)));offset=start+size;}
 assert.equal(entries.size,3);assert.match(entries.get('[Content_Types].xml')!,/wordprocessingml.document.main\+xml/);assert.match(entries.get('word/document.xml')!,/Проверить русский текст &amp; кавычки/);assert.match(entries.get('_rels/.rels')!,/Target="word\/document.xml"/);
});
test('download blobs use real format MIME types',()=>{
 assert.match(buildExportBlob(input,'docx').type,/officedocument.wordprocessingml.document/);assert.match(buildExportBlob(input,'html').type,/text\/html/);assert.match(buildExportBlob(input,'md').type,/text\/markdown/);assert.match(buildExportBlob(input,'txt').type,/text\/plain/);
});
