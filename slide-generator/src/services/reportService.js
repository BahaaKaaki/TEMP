/**
 * reportService.js
 *
 * Generates a self-contained interactive HTML report from research findings.
 * The report creator receives compiled research and plan, then generates
 * a rich, sectioned HTML document with sidebar navigation.
 *
 * Design philosophy: provide a design system (palette, typography, chart
 * library) and structural guidance (pyramid principle, MECE) — but let
 * the model decide the inner visual structure per section.
 *
 * v2 — Chart.js powered interactive charts, modern spacious layout,
 *       thin header, expanded chart types (radar, scatter, area, gauge,
 *       funnel, progress), responsive grid with ratio control.
 */

import { agentChat, getWorkLevelInstructions, currentDateString } from './aiService';
import { audit, describeModel } from '../utils/auditLog';

// ─── Palette — clean consulting SaaS aesthetic ───
const P = {
  // Primary text hierarchy
  primary: '#111827',    // gray-900 - headings
  dark:    '#374151',    // gray-700 - body text
  muted:   '#6B7280',    // gray-500 - secondary text
  light:   '#9CA3AF',    // gray-400 - captions
  // Surfaces
  white:   '#FFFFFF',
  zone:    '#F4F6F9',    // page background
  surface: '#F9FAFB',    // card inner background
  border:  '#E5E7EB',    // borders
  // Brand
  accent:  '#8E1E1E',    // Strategy& maroon
  accentHover: '#A32020',
  accentLight: '#F3E8E8',
  accentSoft: 'rgba(142,30,30,0.08)',
  // Sidebar
  sidebarBg: '#FFFFFF',   // light sidebar
  // Semantic
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger:  '#DC2626',
  dangerBg: '#FEF2F2',
  info:    '#2563EB',
  infoBg:  '#EFF6FF',
  // Chart palette — harmonious with brand
  chart1:  '#8E1E1E',    // maroon
  chart2:  '#C04040',    // lighter red
  chart3:  '#2563EB',    // blue
  chart4:  '#059669',    // emerald
  chart5:  '#D97706',    // amber
  chart6:  '#7C3AED',    // violet
  chart7:  '#0891B2',    // cyan
  chart8:  '#EA580C',    // orange
  // Legacy aliases for compatibility
  black:   '#111827',
  burg:    '#8E1E1E',
  dkRed:   '#6D1515',
  dkGrey:  '#6B7280',
  ltGrey:  '#E5E7EB',
  rose:    '#F4F6F9',
  sidebar: '#FFFFFF',
  blue:    '#2563EB',
  teal:    '#0891B2',
  amber:   '#D97706',
  green:   '#059669',
  slate:   '#6B7280',
  soft:    '#C04040',
};

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Chart rendering script for injection into GPT-generated HTML ───
function getChartRenderingScript() {
  return `<script>
const CHART_COLORS=['${P.chart1}','${P.chart2}','${P.chart3}','${P.chart4}','${P.chart5}','${P.chart6}','${P.chart7}','${P.chart8}','#DC2626','#0891B2'];
function hexToRgba(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return 'rgba('+r+','+g+','+b+','+a+')';}
const defaultOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:16,usePointStyle:true,pointStyle:'rectRounded',font:{size:11}}},tooltip:{backgroundColor:'rgba(17,17,17,.92)',titleFont:{size:12,weight:'600'},bodyFont:{size:11},padding:10,cornerRadius:6}},scales:{x:{grid:{display:false},ticks:{font:{size:11},color:'#6b7280'},border:{display:false}},y:{grid:{color:'#f0f1f3'},ticks:{font:{size:11},color:'#6b7280'},border:{display:false}}}};
function mergeOpts(base,over){const r=JSON.parse(JSON.stringify(base));function m(t,s){for(const k in s){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){t[k]=t[k]||{};m(t[k],s[k])}else{t[k]=s[k]}}}m(r,over);return r;}
function buildBarV(cfg){const data=cfg.data||[];return{type:'bar',data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.value),backgroundColor:data.map((d,i)=>d.color||CHART_COLORS[i%CHART_COLORS.length]),borderRadius:4,maxBarThickness:48}]},options:mergeOpts(defaultOpts,{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}})};}
function buildBarH(cfg){const data=cfg.data||[];return{type:'bar',data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.value),backgroundColor:data.map((d,i)=>d.color||CHART_COLORS[i%CHART_COLORS.length]),borderRadius:4,maxBarThickness:28}]},options:mergeOpts(defaultOpts,{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}})};}
function buildStackedBar(cfg){const data=cfg.data||[];const series=cfg.series||[];return{type:'bar',data:{labels:data.map(d=>d.label),datasets:series.map((sr,si)=>({label:sr.name||sr.key,data:data.map(d=>d[sr.key]||0),backgroundColor:sr.color||CHART_COLORS[si%CHART_COLORS.length],borderRadius:si===series.length-1?{topLeft:4,topRight:4}:0}))},options:mergeOpts(defaultOpts,{scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}})};}
function buildLine(cfg){const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||'Value'}];return{type:'line',data:{labels:datasets[0].data.map(d=>d.label),datasets:datasets.map((ds,di)=>({label:ds.label||'',data:ds.data.map(d=>d.value),borderColor:ds.color||CHART_COLORS[di%CHART_COLORS.length],backgroundColor:'transparent',borderWidth:2.5,pointRadius:4,pointHoverRadius:6,pointBackgroundColor:ds.color||CHART_COLORS[di%CHART_COLORS.length],pointBorderColor:'#fff',pointBorderWidth:2,tension:cfg.smooth?0.4:0.1}))},options:mergeOpts(defaultOpts,{scales:{y:{beginAtZero:cfg.beginAtZero!==false}},plugins:{legend:{display:datasets.length>1}}})};}
function buildArea(cfg){const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||'Value'}];return{type:'line',data:{labels:datasets[0].data.map(d=>d.label),datasets:datasets.map((ds,di)=>{const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];return{label:ds.label||'',data:ds.data.map(d=>d.value),borderColor:color,backgroundColor:hexToRgba(color,0.15),borderWidth:2,fill:true,pointRadius:3,tension:cfg.smooth?0.4:0.2};})},options:mergeOpts(defaultOpts,{scales:{y:{beginAtZero:true}},plugins:{legend:{display:datasets.length>1}}})};}
function buildDonut(cfg){const data=cfg.data||[];const isPie=cfg.type==='pie';return{type:'doughnut',data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.value),backgroundColor:data.map((d,i)=>d.color||CHART_COLORS[i%CHART_COLORS.length]),borderWidth:2,borderColor:'#fff',hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:isPie?0:'62%',plugins:{legend:{position:'right',labels:{padding:14,usePointStyle:true,font:{size:11}}},tooltip:{backgroundColor:'rgba(17,17,17,.92)',bodyFont:{size:11},padding:10,cornerRadius:6}}},plugins:(!isPie&&(cfg.center||cfg.centerLabel))?[{id:'centerText',afterDraw:function(chart){const ctx=chart.ctx;const cx=chart.chartArea.left+(chart.chartArea.right-chart.chartArea.left)/2;const cy=chart.chartArea.top+(chart.chartArea.bottom-chart.chartArea.top)/2;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font="800 22px 'Inter',sans-serif";ctx.fillStyle='${P.burg}';ctx.fillText(cfg.center||'',cx,cy-8);if(cfg.centerLabel){ctx.font="500 9px 'Inter',sans-serif";ctx.fillStyle='#6b7280';ctx.fillText(cfg.centerLabel.toUpperCase(),cx,cy+14);}ctx.restore();}}]:[]};}
function buildRadar(cfg){const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||'Score'}];return{type:'radar',data:{labels:cfg.labels||datasets[0].data.map(d=>d.label),datasets:datasets.map((ds,di)=>{const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];return{label:ds.label||'',data:ds.data.map(d=>typeof d==='number'?d:d.value),borderColor:color,backgroundColor:hexToRgba(color,0.15),borderWidth:2,pointRadius:4,pointBackgroundColor:color,pointBorderColor:'#fff',pointBorderWidth:2};})},options:{responsive:true,maintainAspectRatio:false,scales:{r:{beginAtZero:true,grid:{color:'#e8eaed'},angleLines:{color:'#e8eaed'},pointLabels:{font:{size:11},color:'#374151'},ticks:{display:false}}},plugins:{legend:{position:'bottom',labels:{padding:16,usePointStyle:true,font:{size:11}}},tooltip:{backgroundColor:'rgba(17,17,17,.92)',bodyFont:{size:11},padding:10,cornerRadius:6}}}};}
function buildScatter(cfg){const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||''}];return{type:'scatter',data:{datasets:datasets.map((ds,di)=>{const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];return{label:ds.label||'',data:ds.data.map(d=>({x:d.x,y:d.y})),backgroundColor:hexToRgba(color,0.7),borderColor:color,borderWidth:1.5,pointRadius:ds.pointSize||5};})},options:mergeOpts(defaultOpts,{scales:{x:{title:{display:!!cfg.xLabel,text:cfg.xLabel||''}},y:{title:{display:!!cfg.yLabel,text:cfg.yLabel||''},beginAtZero:true}},plugins:{legend:{display:datasets.length>1}}})};}
function buildBubble(cfg){const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||''}];return{type:'bubble',data:{datasets:datasets.map((ds,di)=>{const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];return{label:ds.label||'',data:ds.data.map(d=>({x:d.x,y:d.y,r:d.r||d.size||8})),backgroundColor:hexToRgba(color,0.5),borderColor:color,borderWidth:1.5};})},options:mergeOpts(defaultOpts,{scales:{x:{title:{display:!!cfg.xLabel,text:cfg.xLabel||''}},y:{title:{display:!!cfg.yLabel,text:cfg.yLabel||''},beginAtZero:true}}})};}
function buildPolar(cfg){const data=cfg.data||[];return{type:'polarArea',data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.value),backgroundColor:data.map((d,i)=>hexToRgba(d.color||CHART_COLORS[i%CHART_COLORS.length],0.65)),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{padding:14,usePointStyle:true,font:{size:11}}},tooltip:{backgroundColor:'rgba(17,17,17,.92)',bodyFont:{size:11},padding:10,cornerRadius:6}},scales:{r:{beginAtZero:true,grid:{color:'#e8eaed'},ticks:{display:false}}}}};}
function buildWaterfall(cfg){const data=cfg.data||[];let running=0;const starts=[],ends=[],colors=[];data.forEach(d=>{if(d.total!=null){starts.push(0);ends.push(d.total);colors.push('${P.burg}');running=d.total;}else{starts.push(running);running+=d.value;ends.push(running);colors.push(d.value>=0?'${P.green}':'#dc2626');}});return{type:'bar',data:{labels:data.map(d=>d.label),datasets:[{data:starts,backgroundColor:'transparent',borderWidth:0,barPercentage:0.6},{data:ends.map((e,i)=>Math.abs(e-starts[i])),backgroundColor:colors,borderRadius:3,barPercentage:0.6}]},options:mergeOpts(defaultOpts,{plugins:{legend:{display:false}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}})};}
function buildMixed(cfg){const datasets=cfg.datasets||[];return{type:'bar',data:{labels:cfg.labels||[],datasets:datasets.map((ds,di)=>{const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];return{label:ds.label||'',data:ds.data||[],borderColor:color,backgroundColor:ds.type==='line'?'transparent':hexToRgba(color,0.8),borderWidth:ds.type==='line'?2.5:0,borderRadius:ds.type==='line'?0:4,type:ds.type||'bar',order:ds.type==='line'?0:1,yAxisID:ds.yAxis||'y',pointRadius:ds.type==='line'?4:undefined,tension:ds.type==='line'?0.2:undefined};})},options:mergeOpts(defaultOpts,{scales:{y:{beginAtZero:true,position:'left'},y1:cfg.y1Label?{beginAtZero:true,position:'right',grid:{display:false},title:{display:true,text:cfg.y1Label}}:undefined}})};}
function buildFunnel(cfg){const data=cfg.data||[];const max=Math.max(...data.map(d=>d.value));return data.map((d,i)=>{const pct=Math.max(30,(d.value/max)*100);const color=d.color||CHART_COLORS[i%CHART_COLORS.length];return'<div style="display:flex;align-items:center;gap:14px;margin-bottom:6px"><div style="width:90px;text-align:right;font-size:12px;font-weight:600;color:#374151">'+d.label+'</div><div style="flex:1;height:32px;background:#f0f1f3;border-radius:4px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px"><span style="font-size:11px;font-weight:700;color:#fff">'+d.value.toLocaleString()+'</span></div></div></div>';}).join('');}
function buildProgress(cfg){const data=cfg.data||[];const max=cfg.max||100;return'<div class="progress-group">'+data.map((d,i)=>{const pct=Math.min(100,(d.value/max)*100);const color=d.color||CHART_COLORS[i%CHART_COLORS.length];return'<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500;color:#374151">'+d.label+'</span><span style="font-size:12px;font-weight:600;color:'+color+'">'+d.value+(cfg.unit||'%')+'</span></div><div style="height:8px;background:#f0f1f3;border-radius:4px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:4px"></div></div></div>';}).join('')+'</div>';}
function buildGauge(cfg){const val=cfg.value||0;const max=cfg.max||100;const pct=Math.min(100,(val/max)*100);const color=cfg.color||'${P.burg}';const canvasId='gauge-'+Math.random().toString(36).substr(2,9);setTimeout(()=>{const canvas=document.getElementById(canvasId);if(!canvas)return;new Chart(canvas.getContext('2d'),{type:'doughnut',data:{datasets:[{data:[pct,100-pct],backgroundColor:[color,'#f0f1f3'],borderWidth:0,circumference:180,rotation:270}]},options:{responsive:true,maintainAspectRatio:false,cutout:'75%',plugins:{legend:{display:false},tooltip:{enabled:false}}},plugins:[{id:'gaugeText',afterDraw:function(chart){const ctx=chart.ctx;const cx=(chart.chartArea.left+chart.chartArea.right)/2;const cy=chart.chartArea.bottom-10;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font="800 20px 'Inter',sans-serif";ctx.fillStyle=color;ctx.fillText(cfg.display||val+(cfg.unit||'%'),cx,cy);ctx.restore();}}]});},100);return'<canvas id="'+canvasId+'" height="100" style="max-width:160px;margin:0 auto;display:block"></canvas>'+(cfg.label?'<div style="text-align:center;font-size:10px;color:#6b7280;margin-top:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:500">'+cfg.label+'</div>':'');}
function renderOneChart(el){try{const cfg=JSON.parse(el.getAttribute('data-chart'));el.setAttribute('data-rendered','1');let html='<div style="margin:28px 0;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:28px 32px">';if(cfg.title)html+='<div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px">'+cfg.title+'</div>';if(cfg.subtitle)html+='<div style="font-size:12.5px;color:#6B7280;margin-bottom:20px">'+cfg.subtitle+'</div>';const chartTypes={'bar-v':buildBarV,'bar-h':buildBarH,'stacked-bar':buildStackedBar,'line':buildLine,'area':buildArea,'donut':buildDonut,'pie':buildDonut,'radar':buildRadar,'scatter':buildScatter,'waterfall':buildWaterfall,'gauge':buildGauge,'funnel':buildFunnel,'progress':buildProgress,'mixed':buildMixed,'bubble':buildBubble,'polar':buildPolar};const builder=chartTypes[cfg.type];if(!builder){html+='<p style="color:#999;font-size:13px">Unknown chart type: '+cfg.type+'</p>';el.innerHTML=html+'</div>';return;}if(cfg.type==='funnel'||cfg.type==='progress'){el.innerHTML=html+builder(cfg)+'</div>';return;}const canvasId='chart-'+Math.random().toString(36).substr(2,9);const h=cfg.height||300;html+='<div style="position:relative;height:'+h+'px;max-height:'+h+'px;overflow:hidden"><canvas id="'+canvasId+'"></canvas></div></div>';el.innerHTML=html;const canvas=document.getElementById(canvasId);if(!canvas)return;const ctx=canvas.getContext('2d');const chartCfg=builder(cfg);new Chart(ctx,chartCfg);}catch(e){console.warn('Chart render error:',e);}}
function renderAllCharts(){document.querySelectorAll('.auto-chart:not([data-rendered])').forEach(renderOneChart);}
document.addEventListener('DOMContentLoaded',renderAllCharts);
<\/script>`;
}

// ─── Team Activity section — collapsible groups, color-coded ───
function buildTeamActivityHTML(teamActivities) {
  if (!teamActivities || teamActivities.length === 0) return '';

  const actionVerbs = {
    scoped: 'Scoped', planned: 'Planned', staffed: 'Joined team', briefed: 'Briefed',
    assigned: 'Assigned', delivered: 'Delivered', reviewed: 'Reviewed', compiled: 'Compiled',
  };

  const groups = teamActivities.map((role, gi) => {
    const isManager = !!role.isManager;
    const dotColor = isManager ? P.accent : P.chart3;
    const badgeBg = isManager ? P.accentLight : P.infoBg;
    const badgeColor = isManager ? P.accent : P.info;
    const roleLabel = isManager ? 'Manager' : 'Consultant';
    const displayName = escapeHTML(role.name || role.role || 'Agent');
    const specialty = role.specialty ? `<span class="ta-specialty">${escapeHTML(role.specialty)}</span>` : '';

    const actionItems = (role.actions || []).map(a => {
      const verb = actionVerbs[a.type] || a.type || 'Action';
      const desc = escapeHTML((a.description || '').length > 100
        ? a.description.slice(0, 97) + '...'
        : a.description || '');
      const arrow = a.briefedTo ? ` <span class="ta-arrow">→</span> <span class="ta-target">${escapeHTML(a.briefedTo)}</span>` : '';
      return `<div class="ta-action"><span class="ta-verb" style="color:${badgeColor}">${escapeHTML(verb)}</span><span class="ta-desc">${desc}${arrow}</span></div>`;
    }).join('\n');

    return `<div class="ta-group">
      <button class="ta-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="ta-dot" style="background:${dotColor}"></span>
        <span class="ta-name">${displayName}</span>
        ${specialty}
        <span class="ta-badge" style="background:${badgeBg};color:${badgeColor}">${roleLabel}</span>
        <span class="ta-count">${role.actions?.length || 0} actions</span>
        <span class="ta-chevron">▸</span>
      </button>
      <div class="ta-actions">${actionItems}</div>
    </div>`;
  }).join('\n');

  return groups;
}

// ─── Appendix builder — structured research data per source ───
function _formatAppendixContent(rawData) {
  if (!rawData) return '';
  let text = rawData.trim();

  // Split into logical blocks by double-newline
  const blocks = text.split(/\n\n+/);
  const htmlParts = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Detect heading lines (## or ### prefixed)
    if (/^#{2,3}\s/.test(trimmed)) {
      const headingText = escapeHTML(trimmed.replace(/^#+\s*/, ''));
      htmlParts.push(`<h4>${headingText}</h4>`);
      continue;
    }

    // Detect bullet lists (lines starting with - or •)
    const lines = trimmed.split('\n');
    const isBulletBlock = lines.every(l => /^\s*[-•*]\s/.test(l) || l.trim() === '');
    if (isBulletBlock && lines.filter(l => l.trim()).length > 0) {
      const items = lines
        .filter(l => /^\s*[-•*]\s/.test(l))
        .map(l => {
          let itemText = escapeHTML(l.replace(/^\s*[-•*]\s*/, ''));
          itemText = itemText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          return `<li>${itemText}</li>`;
        }).join('\n');
      htmlParts.push(`<ul>${items}</ul>`);
      continue;
    }

    // Detect numbered lists
    const isNumberedBlock = lines.every(l => /^\s*\d+[.)]\s/.test(l) || l.trim() === '');
    if (isNumberedBlock && lines.filter(l => l.trim()).length > 0) {
      const items = lines
        .filter(l => /^\s*\d+[.)]\s/.test(l))
        .map(l => {
          let itemText = escapeHTML(l.replace(/^\s*\d+[.)]\s*/, ''));
          itemText = itemText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          return `<li>${itemText}</li>`;
        }).join('\n');
      htmlParts.push(`<ol>${items}</ol>`);
      continue;
    }

    // Detect data/stat blocks (lines with key: value patterns or lots of numbers)
    const hasDataPattern = lines.filter(l => /:\s/.test(l) || /\d{2,}/.test(l)).length > lines.length * 0.5;
    if (hasDataPattern && lines.length > 2) {
      let dataContent = lines.map(l => {
        let escaped = escapeHTML(l);
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return escaped;
      }).join('<br>');
      htmlParts.push(`<div class="apx-data-block">${dataContent}</div>`);
      continue;
    }

    // Default: paragraph(s)
    const paraLines = lines.map(l => {
      let escaped = escapeHTML(l);
      escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return escaped;
    });
    // If multiple short lines, join them; if long, keep as paragraphs
    if (paraLines.length <= 3) {
      htmlParts.push(`<p>${paraLines.join(' ')}</p>`);
    } else {
      for (const pl of paraLines) {
        if (pl.trim()) htmlParts.push(`<p>${pl}</p>`);
      }
    }
  }

  return htmlParts.join('\n');
}

// ─── Rich appendix: per-worker AI calls to produce structured JSON blocks ───
async function generateRichAppendixSections(knowledgeEntries, modelSettings, onProgress) {
  if (!knowledgeEntries || knowledgeEntries.length === 0) return [];

  if (onProgress) onProgress(`Generating rich appendix (${knowledgeEntries.length} sources)...`);

  const results = await Promise.all(knowledgeEntries.map(async (entry, i) => {
    const sourceName = entry.source || `Source ${i + 1}`;
    const rawData = (entry.data || '').trim();
    if (!rawData || rawData.length < 50) {
      return { source: sourceName, html: `<p>${escapeHTML(rawData || 'No data')}</p>`, wordCount: rawData.split(/\s+/).length };
    }

    const wordCount = rawData.split(/\s+/).length;

    try {
      const prompt = `Convert this consultant's research findings into structured JSON blocks for a report appendix. Extract EVERY data point, statistic, and finding — nothing should be lost.
TODAY: ${currentDateString()}

SOURCE: ${sourceName}

RESEARCH DATA:
${rawData.slice(0, 30000)}

${JSON_BLOCK_SCHEMA}

═══ OUTPUT FORMAT ═══
{
  "blocks": [ ...array of block objects... ]
}

═══ REQUIREMENTS ═══
- Extract ALL data points, statistics, percentages, and findings into visual blocks
- Use metrics/scorecards for headline numbers and KPIs
- Use charts (line, bar-v, donut, radar) for any numerical trends or distributions — 4+ data points each
- Use tables (4+ rows) for structured comparisons, rankings, or breakdowns
- Use icon-cards (4-6 items) for key findings, recommendations, or categories
- Use paragraphs (3-5 sentences each) for analysis and context — not vague summaries
- Use key-finding blocks for the most important insights
- Use sub-category blocks to organize into logical themes
- Minimum 8 blocks, more for data-rich entries
- ALL data from the research must appear — this is an APPENDIX, completeness matters
- Do NOT fabricate data — only use what is in the research

Output ONLY valid JSON — no markdown, no explanation.`;

      const callOpts = {
        systemPrompt: `You are a data analyst converting research findings into rich visual JSON blocks. TODAY: ${currentDateString()}. Output ONLY valid JSON.`,
        returnJSON: true,
        temperature: 0.3,
        maxTokens: 16000,
        timeout: 120000,
      };

      const result = await agentChat(prompt, modelSettings, callOpts);

      let parsed;
      if (typeof result === 'string') {
        let cleaned = result.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(cleaned);
      } else {
        parsed = result;
      }

      const blocks = parsed.blocks || parsed.content || [];
      const html = renderBlocksToHTML(blocks);
      return { source: sourceName, html, wordCount, blockCount: blocks.length };
    } catch (err) {
      console.warn(`[Appendix] Failed to generate rich content for "${sourceName}":`, err.message);
      // Fallback to basic text formatting
      const html = _formatAppendixContent(rawData);
      return { source: sourceName, html, wordCount, blockCount: 0 };
    }
  }));

  return results;
}

function buildAppendixHTML(appendixSections) {
  if (!appendixSections || appendixSections.length === 0) return '';

  const sources = appendixSections.map((entry, i) => {
    const sourceName = escapeHTML(entry.source || `Source ${i + 1}`);
    const wordCount = entry.wordCount || 0;
    const blockInfo = entry.blockCount ? `${entry.blockCount} blocks` : '';
    const meta = [wordCount ? `${wordCount.toLocaleString()} words` : '', blockInfo].filter(Boolean).join(' \u00b7 ');

    return `<div class="appendix-source open" id="appendix-src-${i}">
      <button class="appendix-source-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="appendix-source-num">${i + 1}</span>
        <span class="appendix-source-title">${sourceName}</span>
        <span class="appendix-source-meta">${meta}</span>
        <span class="appendix-source-toggle">\u25b8</span>
      </button>
      <div class="appendix-source-body">
        <div class="appendix-source-content">${entry.html}</div>
      </div>
    </div>`;
  }).join('\n');

  return sources;
}

// ─── HTML shell — spacious SaaS dashboard design ───
function wrapInHTMLShell(title, subtitle, tabsJSON, teamActivities, appendixSections) {
  const tabs = typeof tabsJSON === 'string' ? JSON.parse(tabsJSON) : tabsJSON;

  const tabButtons = tabs.map((t, i) =>
    `<a class="nav-item${i === 0 ? ' active' : ''}" onclick="switchTab(${i})" title="${escapeHTML(t.title)}">
      <span class="nav-label">${escapeHTML(t.shortTitle || t.title)}</span>
    </a>`
  ).join('\n        ');

  const tabPanels = tabs.map((t, i) =>
    `<div class="tab-panel" id="panel-${i}" data-section="${i + 1}">
      <header class="section-header">
        <div class="section-meta">
          <span class="section-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="section-divider-dot">/</span>
          <span class="section-of">${String(tabs.length).padStart(2, '0')}</span>
        </div>
        <h1 class="section-title">${escapeHTML(t.title)}</h1>
        ${t.subtitle ? `<p class="section-subtitle">${escapeHTML(t.subtitle)}</p>` : ''}
      </header>
      <div class="section-content">${t.html}</div>
    </div>`
  ).join('\n      ');

  const teamActivityHTML = buildTeamActivityHTML(teamActivities);
  const appendixHTML = buildAppendixHTML(appendixSections);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>
/* ═══ Reset ═══ */
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;background:${P.zone};color:${P.dark};line-height:1.65;-webkit-font-smoothing:antialiased;height:100%;overflow:hidden;display:flex}

/* ═══ Layout ═══ */
.report-wrapper{display:flex;width:100%;height:100vh}

/* ═══ Sidebar — Light, spacious, sections only ═══ */
.sidebar{width:260px;min-width:260px;background:${P.sidebarBg};border-right:1px solid ${P.border};display:flex;flex-direction:column;height:100vh;position:fixed;left:0;top:0;z-index:100}
.sidebar-brand{padding:32px 28px 28px;border-bottom:1px solid ${P.border}}
.sidebar-brand h2{font-size:15px;font-weight:700;color:${P.primary};letter-spacing:0.3px;margin-bottom:4px}
.sidebar-brand span{display:block;font-size:11px;color:${P.muted};text-transform:uppercase;letter-spacing:1.5px;font-weight:500}
.sidebar-actions{display:flex;gap:8px;margin-top:20px}
.sidebar-actions button{flex:1;padding:8px 12px;font-size:11px;font-weight:600;border-radius:8px;border:1px solid ${P.border};background:transparent;color:${P.muted};cursor:pointer;transition:all .2s;font-family:inherit}
.sidebar-actions button:hover{background:${P.zone};color:${P.primary};border-color:${P.light}}
.sidebar-actions .btn-primary{background:${P.accent};color:#fff;border-color:${P.accent}}
.sidebar-actions .btn-primary:hover{background:${P.accentHover}}

/* ═══ Navigation — Clean sections, no clutter, scrollspy-friendly ═══ */
.sidebar-nav{flex:1;padding:20px 16px;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;display:flex;flex-direction:column;gap:2px}
.sidebar-nav::-webkit-scrollbar{display:none}
.nav-group-label{font-size:10px;font-weight:600;color:${P.light};text-transform:uppercase;letter-spacing:1.5px;padding:16px 12px 8px}
.nav-item{display:flex;align-items:center;gap:12px;padding:11px 16px;border-radius:10px;color:${P.muted};font-size:13.5px;font-weight:500;cursor:pointer;transition:all .2s;border:none;background:none;text-align:left;width:100%;text-decoration:none;font-family:inherit}
.nav-item:hover{background:${P.zone};color:${P.primary}}
.nav-item.active{background:${P.accentSoft};color:${P.accent};font-weight:600}
.nav-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.nav-divider{height:1px;background:${P.border};margin:12px 4px}
.sidebar-footer{padding:20px 24px;border-top:1px solid ${P.border};font-size:11px;color:${P.light}}

/* ═══ Main Content — Spacious, no visible scrollbar ═══ */
.main-content{flex:1;min-width:0;background:${P.zone};margin-left:260px;overflow-y:auto;height:100vh;scrollbar-width:none;-ms-overflow-style:none}
.main-content::-webkit-scrollbar{display:none}
/* ═══ Section Panel — clear separation between sections ═══ */
.tab-panel{display:block;border-top:4px solid ${P.zone}}
.tab-panel:first-child{border-top:none}
.tab-panel+.tab-panel{margin-top:0}

/* ═══ Section Header — prominent banner for each section ═══ */
.section-header{background:${P.zone};padding:48px 56px 36px;border-bottom:3px solid ${P.accentLight};position:relative}
.section-header::before{content:'';position:absolute;left:0;bottom:-3px;width:120px;height:3px;background:${P.accent};z-index:1}
.section-meta{display:flex;align-items:center;gap:6px;margin-bottom:14px}
.section-num{font-size:13px;font-weight:800;color:${P.accent};letter-spacing:1px;background:${P.accentLight};padding:3px 10px;border-radius:6px}
.section-divider-dot{font-size:12px;color:${P.light}}
.section-of{font-size:12px;color:${P.light}}
.section-title{font-size:28px;font-weight:800;color:${P.primary};letter-spacing:-0.5px;line-height:1.25}
.section-subtitle{font-size:15px;color:${P.muted};margin-top:10px;line-height:1.6;max-width:680px}

/* ═══ Section Content — Wide padding, max-width for readability ═══ */
.section-content{padding:48px 56px 72px;background:${P.white};max-width:100%}

/* ═══ Typography — Spacious and readable ═══ */
.section-content h2{font-size:24px;font-weight:800;color:${P.primary};margin:44px 0 18px;letter-spacing:-0.5px;padding-bottom:12px;border-bottom:2px solid ${P.accentLight}}
.section-content h3{font-size:19px;font-weight:700;color:${P.accent};margin:36px 0 14px;display:flex;align-items:center;gap:10px}
.section-content h3::before{content:'';width:4px;height:20px;background:${P.accent};border-radius:2px;flex-shrink:0}
.section-content h4{font-size:13px;font-weight:700;color:${P.muted};text-transform:uppercase;letter-spacing:1.2px;margin:28px 0 12px}
.block-label{font-size:10px;font-weight:700;color:${P.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:6px}
.section-content p{font-size:14.5px;line-height:1.75;color:${P.dark};margin-bottom:18px}
.section-content ul,.section-content ol{margin:12px 0 20px 20px;font-size:14.5px;line-height:1.75;color:${P.dark}}
.section-content li{margin-bottom:8px}
.section-content li::marker{color:${P.accent}}
.section-content strong{color:${P.primary};font-weight:600}
.section-content a{color:${P.accent};text-decoration:none}

/* ═══ Key Finding ═══ */
.key-finding{background:${P.zone};border-left:4px solid ${P.accent};padding:28px 32px;margin:36px 0;border-radius:0 12px 12px 0}
.key-finding .kf-label{font-size:10px;font-weight:700;color:${P.accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.key-finding p{margin:0;font-size:14.5px;color:${P.dark};line-height:1.7}

/* ═══ Callout variants ═══ */
.callout{padding:28px 32px;margin:36px 0;border-radius:0 12px 12px 0;border-left:4px solid}
.callout.blue{background:${P.infoBg};border-color:${P.info}}
.callout.amber{background:${P.warningBg};border-color:${P.warning}}
.callout.green{background:${P.successBg};border-color:${P.success}}
.callout.teal{background:#f0fdfa;border-color:${P.teal}}
.callout .callout-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.callout.blue .callout-label{color:${P.info}}
.callout.amber .callout-label{color:#b45309}
.callout.green .callout-label{color:${P.success}}
.callout.teal .callout-label{color:${P.teal}}
.callout p{margin:0;font-size:14px;color:${P.dark};line-height:1.7}

/* ═══ Metric Cards — Spacious, breathing room ═══ */
.metric-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin:32px 0}
.metric-card{background:${P.white};border:1px solid ${P.border};border-radius:12px;padding:28px 24px;text-align:center;transition:all .2s}
.metric-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.mc-value{font-size:36px;font-weight:800;color:${P.accent};letter-spacing:-1px;line-height:1}
.mc-label{font-size:12px;color:${P.muted};margin-top:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600}
.mc-delta{font-size:11px;margin-top:10px;font-weight:600;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px}
.mc-delta.up{color:${P.success};background:${P.successBg}}
.mc-delta.down{color:${P.danger};background:${P.dangerBg}}
.mc-delta.flat{color:${P.muted};background:${P.zone}}

/* ═══ Data Table — Spacious ═══ */
.data-table{width:100%;border-collapse:collapse;margin:28px 0;font-size:13px;border-radius:12px;overflow:hidden;border:1px solid ${P.border}}
.data-table th{background:${P.zone};color:${P.primary};padding:14px 20px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${P.border}}
.data-table td{padding:14px 20px;border-bottom:1px solid ${P.zone};color:${P.dark}}
.data-table tr:last-child td{border-bottom:none}
.data-table tr:hover td{background:${P.zone}}
.data-table .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:${P.primary}}

/* ═══ Chevron Flow ═══ */
.chevron-flow{display:flex;flex-direction:column;gap:12px;margin:28px 0}
.chevron{padding:20px 24px;background:${P.white};border:1px solid ${P.border};border-radius:12px;transition:all .2s}
.chevron:hover{box-shadow:0 4px 12px rgba(0,0,0,.05)}
.chevron.active{background:${P.accent};color:#fff;border-color:${P.accent}}
.chevron.active .chev-title{color:#fff}
.chevron.active .chev-num{color:rgba(255,255,255,.5)}
.chevron.active .chev-desc{color:rgba(255,255,255,.8)}
.chev-num{font-size:20px;font-weight:800;color:${P.border};line-height:1;margin-bottom:4px}
.chev-title{font-weight:700;font-size:14px;color:${P.primary};margin-bottom:4px}
.chev-desc{font-size:13px;color:${P.muted};line-height:1.5}

/* ═══ Compare Cards ═══ */
.compare-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin:28px 0}
.compare-card{background:${P.white};border:1px solid ${P.border};border-radius:12px;padding:28px;border-top:4px solid ${P.accent};transition:all .2s}
.compare-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.compare-card h5{font-size:16px;font-weight:700;color:${P.primary};margin-bottom:12px}
.compare-card p{font-size:13.5px;color:${P.muted};margin-bottom:10px;line-height:1.65}

/* ═══ Tags ═══ */
.tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-right:6px;margin-top:4px}
.tag.green{background:${P.successBg};color:${P.success}}
.tag.red{background:${P.dangerBg};color:${P.danger}}
.tag.grey{background:${P.zone};color:${P.muted}}
.tag.blue{background:${P.infoBg};color:${P.info}}
.tag.amber{background:${P.warningBg};color:#b45309}

/* ═══ Score Dots ═══ */
.score{display:inline-flex;gap:4px}
.score .dot{width:10px;height:10px;border-radius:50%;background:${P.border}}
.score .dot.filled{background:${P.accent}}

/* ═══ Source Note ═══ */
.source-note{font-size:12px;color:${P.light};margin-top:32px;padding-top:16px;border-top:1px solid ${P.border};font-style:italic}

/* ═══ Section Divider ═══ */
.section-divider{height:2px;background:linear-gradient(90deg,${P.accentLight},${P.border},transparent);margin:48px 0}

/* ═══ Grid Utilities — Proper multi-column grids ═══ */
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin:28px 0}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:28px 0}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:28px 0}
.grid-2-1{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin:28px 0}
.grid-1-2{display:grid;grid-template-columns:1fr 2fr;gap:20px;margin:28px 0}
.grid-3-2{display:grid;grid-template-columns:3fr 2fr;gap:20px;margin:28px 0}
.grid-2-3{display:grid;grid-template-columns:2fr 3fr;gap:20px;margin:28px 0}
.flex-row{display:flex;gap:20px;margin:28px 0;flex-wrap:wrap}
.flex-row>*{flex:1;min-width:240px}
.stack{display:flex;flex-direction:column;gap:20px}

/* ═══ Card — Spacious consulting style ═══ */
.card{background:${P.white};border:1px solid ${P.border};border-radius:12px;padding:28px;transition:all .2s}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06)}
.card.bordered-top{border-top:4px solid ${P.accent}}
.card .card-title{font-size:16px;font-weight:700;color:${P.primary};margin-bottom:12px}
.card .card-text{font-size:13.5px;color:${P.muted};line-height:1.7}
.card ul,.card ol{margin:10px 0 0 18px;font-size:13.5px;line-height:1.7;color:${P.dark}}
.card li{margin-bottom:8px}
.card li::marker{color:${P.accent}}

/* ═══ Chart Container — Generous space for readable charts ═══ */
.chart-container{margin:36px 0;background:${P.white};border:1px solid ${P.border};border-radius:12px;padding:32px 32px}
.chart-container .chart-title{font-size:14px;font-weight:700;color:${P.primary};margin-bottom:4px}
.chart-container .chart-subtitle{font-size:12.5px;color:${P.muted};margin-bottom:20px}
.chart-container canvas{max-height:320px}

/* ═══ Progress Bars ═══ */
.progress-group{margin:28px 0}
.progress-item{margin-bottom:18px}
.progress-item .prog-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.progress-item .prog-label{font-size:13px;font-weight:600;color:${P.dark}}
.progress-item .prog-value{font-size:13px;font-weight:700;color:${P.accent}}
.progress-item .prog-track{height:8px;background:${P.zone};border-radius:4px;overflow:hidden}
.progress-item .prog-fill{height:100%;border-radius:4px;background:${P.accent}}

/* ═══ Timeline ═══ */
.timeline{position:relative;margin:28px 0;padding-left:28px;border-left:2px solid ${P.border}}
.timeline-item{position:relative;padding:0 0 28px 24px}
.timeline-item::before{content:'';position:absolute;left:-33px;top:4px;width:12px;height:12px;border-radius:50%;background:${P.white};border:3px solid ${P.accent}}
.timeline-item.active::before{background:${P.accent}}
.timeline-item:last-child{padding-bottom:0}
.timeline-item .tl-date{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${P.accent};font-weight:700;margin-bottom:4px}
.timeline-item .tl-title{font-size:15px;font-weight:700;color:${P.primary};margin-bottom:4px}
.timeline-item .tl-desc{font-size:13px;color:${P.muted};line-height:1.6}

/* ═══ Stat Highlight ═══ */
.stat-highlight{display:flex;align-items:center;gap:20px;padding:24px 28px;background:${P.white};border:1px solid ${P.border};border-radius:12px;margin:20px 0}
.stat-highlight .stat-big{font-size:36px;font-weight:800;color:${P.accent};letter-spacing:-1px;line-height:1}
.stat-highlight .stat-text{font-size:14px;color:${P.dark};line-height:1.6}
.stat-highlight .stat-text strong{color:${P.primary}}

/* ═══ Visual Primitives ═══ */
.num-circle{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${P.accent};color:#fff;font-size:13px;font-weight:700;flex-shrink:0}
.num-circle.sm{width:24px;height:24px;font-size:11px}
.letter-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:${P.accent};color:#fff;font-size:12px;font-weight:800;flex-shrink:0}
.icon-circle{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;background:${P.accentLight};color:${P.accent};font-size:18px;flex-shrink:0}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;background:${P.zone};color:${P.dark}}
.pill.accent{background:${P.accentLight};color:${P.accent}}
.accent-bar{width:4px;border-radius:2px;background:${P.accent};flex-shrink:0;align-self:stretch}
.h-divider{height:1px;background:${P.border};margin:28px 0}
.v-divider{width:1px;background:${P.border};align-self:stretch;flex-shrink:0}

/* ═══ Sub-category Header — visual section divider ═══ */
.sub-category{margin:48px 0 28px;padding:20px 0 16px;border-bottom:2px solid ${P.accentLight};border-top:1px solid ${P.border};position:relative}
.sub-category .sc-label{font-size:11px;font-weight:800;color:${P.accent};text-transform:uppercase;letter-spacing:2.5px;margin-bottom:8px}
.sub-category .sc-title{font-size:22px;font-weight:800;color:${P.primary};letter-spacing:-0.3px;line-height:1.3}
.sub-category .sc-desc{font-size:14px;color:${P.muted};margin-top:8px;line-height:1.6;max-width:640px}
.sub-category::before{content:'';position:absolute;left:0;bottom:-2px;width:80px;height:3px;background:${P.accent};border-radius:2px}

/* ═══ Icon Cards — visual cards with colored icons ═══ */
.icon-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin:28px 0}
.icon-card{background:${P.white};border:1px solid ${P.border};border-radius:14px;padding:28px;display:flex;gap:18px;align-items:flex-start;transition:all .25s;overflow:hidden}
.icon-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.07);transform:translateY(-3px)}
.icon-card .ic-icon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;font-size:20px;flex-shrink:0;margin-top:2px}
.icon-card .ic-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.icon-card .ic-value{font-size:24px;font-weight:800;color:${P.accent};line-height:1.2;margin-bottom:6px;letter-spacing:-0.5px;word-break:break-word}
.icon-card .ic-title{font-size:14px;font-weight:700;color:${P.primary};margin-bottom:4px;line-height:1.4;word-break:break-word}
.icon-card .ic-text{font-size:13px;color:${P.muted};line-height:1.65;word-break:break-word}
.icon-card.accent-blue .ic-icon{background:${P.infoBg};color:${P.info}}
.icon-card.accent-green .ic-icon{background:${P.successBg};color:${P.success}}
.icon-card.accent-amber .ic-icon{background:${P.warningBg};color:${P.warning}}
.icon-card.accent-red .ic-icon{background:${P.accentLight};color:${P.accent}}
.icon-card.accent-violet .ic-icon{background:#f3e8ff;color:#7C3AED}
.icon-card.accent-teal .ic-icon{background:#f0fdfa;color:${P.teal}}

/* ═══ Highlight Box — gradient accent banner ═══ */
.highlight-box{background:linear-gradient(135deg,${P.accent} 0%,#B83030 50%,${P.accentHover} 100%);border-radius:16px;padding:36px 36px;color:#fff;margin:40px 0;position:relative;overflow:hidden}
.highlight-box::after{content:'';position:absolute;top:-30%;right:-5%;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.06)}
.highlight-box .hb-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.65);margin-bottom:14px}
.highlight-box .hb-value{font-size:44px;font-weight:800;line-height:1.1;margin-bottom:10px;letter-spacing:-1px}
.highlight-box .hb-text{font-size:15px;line-height:1.65;color:rgba(255,255,255,0.88);max-width:600px}

/* ═══ Matrix 2×2 — quadrant visualization ═══ */
.matrix-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:28px 0;border-radius:14px;overflow:hidden;border:1px solid ${P.border};background:${P.border}}
.matrix-cell{padding:28px;background:${P.white};text-align:center;transition:all .2s}
.matrix-cell:hover{background:${P.surface}}
.matrix-cell .mx-quadrant{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;color:${P.muted}}
.matrix-cell .mx-title{font-size:15px;font-weight:700;color:${P.primary};margin-bottom:8px}
.matrix-cell .mx-desc{font-size:12.5px;color:${P.muted};line-height:1.55}
.matrix-cell .mx-icon{font-size:28px;margin-bottom:10px;display:block}
.matrix-labels{display:flex;justify-content:center;gap:6px;margin-top:8px}
.matrix-labels span{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:${P.light}}

/* ═══ Pill List — horizontal tags ═══ */
.pill-list{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}

/* ═══ Visual Separator — decorative divider ═══ */
.visual-sep{display:flex;align-items:center;gap:16px;margin:48px 0}
.visual-sep .vs-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,${P.border},transparent)}
.visual-sep .vs-icon{font-size:14px;color:${P.accent};background:${P.accentLight};width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%}
.visual-sep .vs-text{font-size:11px;font-weight:600;color:${P.muted};text-transform:uppercase;letter-spacing:1px}

/* ═══ Scorecard — metric with colored indicator ═══ */
.scorecard-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:28px 0}
.scorecard{background:${P.white};border:1px solid ${P.border};border-radius:12px;padding:24px;position:relative;overflow:hidden;transition:all .2s}
.scorecard:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.scorecard .sc-bar{position:absolute;left:0;top:0;width:4px;height:100%;border-radius:0 2px 2px 0}
.scorecard .sc-value{font-size:28px;font-weight:800;color:${P.primary};letter-spacing:-0.5px;line-height:1}
.scorecard .sc-label{font-size:12px;color:${P.muted};margin-top:8px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.scorecard .sc-status{display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
.scorecard .sc-status.good{color:${P.success};background:${P.successBg}}
.scorecard .sc-status.warn{color:${P.warning};background:${P.warningBg}}
.scorecard .sc-status.bad{color:${P.danger};background:${P.dangerBg}}

/* ═══ Smart Chart Sizing ═══ */
.chart-sm{max-width:480px}
.chart-md{max-width:640px}
.chart-centered{margin-left:auto;margin-right:auto}

/* ═══ Consulting-style Numbered List ═══ */
.num-list{list-style:none;margin:16px 0;padding:0}
.num-list li{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;font-size:14px;color:${P.dark};line-height:1.7}
.num-list .num-box{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:8px;background:${P.accent};color:#fff;font-size:12px;font-weight:700;flex-shrink:0}
.num-list .num-text{flex:1}
.num-list .num-text strong{color:${P.primary}}

/* ═══ Team Activity — collapsible groups ═══ */
.ta-section{padding:40px 56px 64px;background:${P.white}}
.ta-section-title{font-size:20px;font-weight:700;color:${P.primary};margin-bottom:8px;letter-spacing:-0.3px}
.ta-section-subtitle{font-size:13px;color:${P.muted};margin-bottom:28px;line-height:1.6}
.ta-group{border:1px solid ${P.border};border-radius:12px;margin-bottom:10px;overflow:hidden;transition:all .2s}
.ta-group:hover{border-color:${P.light}}
.ta-header{display:flex;align-items:center;gap:10px;width:100%;padding:14px 18px;background:${P.surface};border:none;cursor:pointer;font-family:inherit;font-size:13px;text-align:left;transition:background .2s}
.ta-header:hover{background:${P.zone}}
.ta-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.ta-name{font-weight:700;color:${P.primary};font-size:13.5px}
.ta-specialty{font-size:11px;color:${P.muted};font-weight:400}
.ta-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px}
.ta-count{font-size:11px;color:${P.light};margin-left:auto}
.ta-chevron{font-size:10px;color:${P.light};transition:transform .2s;flex-shrink:0}
.ta-group.open .ta-chevron{transform:rotate(90deg)}
.ta-actions{max-height:0;overflow:hidden;transition:max-height .3s ease}
.ta-group.open .ta-actions{max-height:2000px}
.ta-action{display:flex;align-items:baseline;gap:8px;padding:8px 18px 8px 38px;font-size:12.5px;border-top:1px solid ${P.zone}}
.ta-action:first-child{border-top:1px solid ${P.border}}
.ta-verb{font-weight:600;flex-shrink:0;min-width:64px;font-size:11px;text-transform:uppercase;letter-spacing:0.3px}
.ta-desc{color:${P.dark};line-height:1.5;flex:1}
.ta-arrow{color:${P.light};font-size:10px}
.ta-target{color:${P.muted};font-weight:500;font-size:11px}

/* ═══ Appendix — Structured research data per source ═══ */
.appendix-section{padding:40px 56px 64px;background:${P.white}}
.appendix-intro{font-size:14px;color:${P.muted};margin-bottom:32px;line-height:1.7;max-width:700px}
.appendix-source{margin-bottom:32px;border:1px solid ${P.border};border-radius:14px;overflow:hidden;border-top:4px solid ${P.accent}}
.appendix-source-header{display:flex;align-items:center;gap:14px;padding:20px 28px;background:${P.zone};border-bottom:1px solid ${P.border};cursor:pointer;font-family:inherit;width:100%;border-left:none;border-right:none;border-top:none;text-align:left;transition:background .2s}
.appendix-source-header:hover{background:${P.surface}}
.appendix-source-num{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;background:${P.accent};color:#fff;font-size:12px;font-weight:800;flex-shrink:0}
.appendix-source-title{font-size:16px;font-weight:700;color:${P.primary};flex:1}
.appendix-source-meta{font-size:11px;color:${P.muted};flex-shrink:0;text-align:right;line-height:1.5}
.appendix-source-toggle{font-size:12px;color:${P.light};transition:transform .2s;flex-shrink:0;margin-left:4px}
.appendix-source.open .appendix-source-toggle{transform:rotate(90deg)}
.appendix-source-body{max-height:0;overflow:hidden;transition:max-height .4s ease}
.appendix-source.open .appendix-source-body{max-height:200000px}
.appendix-source-content{padding:28px 28px 32px;font-size:14px;color:${P.dark};line-height:1.8}
.appendix-source-content p{margin-bottom:14px}
.appendix-source-content h4{font-size:16px;font-weight:700;color:${P.primary};margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid ${P.border}}
.appendix-source-content h5{font-size:14px;font-weight:700;color:${P.accent};margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px}
.appendix-source-content ul,.appendix-source-content ol{margin:10px 0 18px 24px}
.appendix-source-content li{margin-bottom:8px;line-height:1.7}
.appendix-source-content li::marker{color:${P.accent}}
.appendix-source-content strong{color:${P.primary};font-weight:700}
.appendix-source-content code{background:${P.zone};padding:2px 6px;border-radius:4px;font-size:12px}
.appendix-source-content blockquote{border-left:3px solid ${P.accent};padding:12px 20px;margin:16px 0;background:${P.accentSoft};border-radius:0 8px 8px 0;font-style:italic;color:${P.muted}}
.appendix-source-content .apx-data-block{background:${P.zone};border:1px solid ${P.border};border-radius:10px;padding:20px 24px;margin:16px 0;font-size:13.5px;line-height:1.75}
.appendix-source-content .apx-data-block p{margin-bottom:10px}
.appendix-source-content .apx-data-block:last-child p:last-child{margin-bottom:0}

/* ═══ Responsive ═══ */
@media(max-width:768px){
  .sidebar{display:none}
  .main-content{margin-left:0}
  .section-content{padding:24px 20px 40px}
  .section-header{padding:28px 20px 24px}
  .appendix-section{padding:24px 20px 40px}
  .grid-2,.grid-3,.grid-4{grid-template-columns:1fr}
  .grid-2-1,.grid-1-2,.grid-3-2,.grid-2-3{grid-template-columns:1fr}
  .metric-row{grid-template-columns:repeat(2,1fr)}
}

/* ═══ Print ═══ */
@media print{
  .sidebar{display:none}
  .tab-panel{display:block!important;page-break-after:always}
  .report-wrapper{display:block}
  .main-content{width:100%;margin-left:0;overflow:visible;height:auto}
}
</style>
</head>
<body>
  <div class="report-wrapper">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h2>${escapeHTML(title).split(' ').slice(0, 5).join(' ')}</h2>
        <span>Executive Report</span>
        <div class="sidebar-actions">
          <button onclick="window.print()">Print</button>
          <button class="btn-primary" onclick="downloadReport()">Download</button>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-group-label">Sections</div>
        ${tabButtons}
        ${appendixHTML ? `<div class="nav-divider"></div><div class="nav-group-label">Reference</div><a class="nav-item" onclick="switchTab(${tabs.length})" title="Appendix"><span class="nav-label">Appendix — Full Research</span></a>` : ''}
        ${teamActivityHTML ? `<div class="nav-divider"></div><a class="nav-item" onclick="switchTab(${tabs.length + (appendixHTML ? 1 : 0)})" title="Team Activity"><span class="nav-label">Team Activity</span></a>` : ''}
      </nav>
      <div class="sidebar-footer">Confidential &middot; ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
    </aside>
    <main class="main-content">
      ${tabPanels}
      ${appendixHTML ? `<div class="tab-panel" id="panel-${tabs.length}" data-section="${tabs.length + 1}">
        <header class="section-header">
          <div class="section-meta">
            <span class="section-num">${String(tabs.length + 1).padStart(2, '0')}</span>
            <span class="section-divider-dot">/</span>
            <span class="section-of">${String(tabs.length + (appendixHTML ? 1 : 0) + (teamActivityHTML ? 1 : 0)).padStart(2, '0')}</span>
          </div>
          <h1 class="section-title">Appendix — Full Research Data</h1>
          <p class="section-subtitle">Complete research findings from each consultant, with structured analysis and visualizations</p>
        </header>
        <div class="appendix-section">
          <p class="appendix-intro">This appendix contains the complete research data gathered by each team member, structured into visual blocks for easy consumption. Click on any source to expand.</p>
          ${appendixHTML}
        </div>
      </div>` : ''}
      ${teamActivityHTML ? `<div class="tab-panel" id="panel-${tabs.length + (appendixHTML ? 1 : 0)}" data-section="${tabs.length + (appendixHTML ? 1 : 0) + 1}">
        <header class="section-header">
          <div class="section-meta">
            <span class="section-num">${String(tabs.length + (appendixHTML ? 1 : 0) + 1).padStart(2, '0')}</span>
            <span class="section-divider-dot">/</span>
            <span class="section-of">${String(tabs.length + (appendixHTML ? 1 : 0) + (teamActivityHTML ? 1 : 0)).padStart(2, '0')}</span>
          </div>
          <h1 class="section-title">Team Activity</h1>
          <p class="section-subtitle">How we got here — the research process and team contributions</p>
        </header>
        <div class="ta-section">${teamActivityHTML}</div>
      </div>` : ''}
    </main>
  </div>

<script>
/* ─── Navigation: click to scroll, scrollspy highlights active ─── */
function switchTab(i){
  const panel=document.getElementById('panel-'+i);
  if(!panel) return;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
  // Render charts in target panel
  setTimeout(()=>renderChartsInPanel(i),100);
}
function renderChartsInPanel(i){
  const panel=document.getElementById('panel-'+i);
  if(!panel) return;
  panel.querySelectorAll('.auto-chart:not([data-rendered])').forEach(renderOneChart);
}

/* ─── Scrollspy: highlight nav item based on scroll position ─── */
(function(){
  const main=document.querySelector('.main-content');
  if(!main) return;
  let ticking=false;
  function updateScrollspy(){
    const panels=document.querySelectorAll('.tab-panel');
    const navItems=document.querySelectorAll('.nav-item');
    const scrollTop=main.scrollTop;
    const offset=120;
    let activeIdx=0;
    for(let i=0;i<panels.length;i++){
      if(panels[i].offsetTop-main.offsetTop<=scrollTop+offset) activeIdx=i;
    }
    navItems.forEach((n,j)=>n.classList.toggle('active',j===activeIdx));
    // Ensure active nav item is scrolled into view in sidebar
    const activeNav=navItems[activeIdx];
    if(activeNav){
      const sidebar=document.querySelector('.sidebar-nav');
      if(sidebar){
        const navTop=activeNav.offsetTop-sidebar.offsetTop;
        const navBottom=navTop+activeNav.offsetHeight;
        if(navTop<sidebar.scrollTop||navBottom>sidebar.scrollTop+sidebar.clientHeight){
          activeNav.scrollIntoView({behavior:'smooth',block:'nearest'});
        }
      }
    }
    ticking=false;
  }
  main.addEventListener('scroll',function(){
    if(!ticking){ticking=true;requestAnimationFrame(updateScrollspy);}
  });
  // Render all charts on load (since all panels are visible)
  document.addEventListener('DOMContentLoaded',function(){
    const panels=document.querySelectorAll('.tab-panel');
    panels.forEach(function(p,i){setTimeout(function(){renderChartsInPanel(i);},i*100);});
  });
})();

/* ─── Download ─── */
function downloadReport(){
  const blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='${escapeHTML(title).replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_report.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ═══════════════════════════════════════════════════════════════════
   CHART LIBRARY — Chart.js powered interactive charts
   The model writes <div class="auto-chart" data-chart='JSON'></div>
   and this script renders them on page load.
   ═══════════════════════════════════════════════════════════════════ */
const CHART_COLORS=['${P.chart1}','${P.chart2}','${P.chart3}','${P.chart4}','${P.chart5}','${P.chart6}','${P.chart7}','${P.chart8}','#e11d48','#0891b2'];

function hexToRgba(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

function renderOneChart(el){
  try{
    const cfg=JSON.parse(el.getAttribute('data-chart'));
    el.setAttribute('data-rendered','1');

    // Build wrapper
    let html='<div class="chart-container">';
    if(cfg.title) html+='<div class="chart-title">'+cfg.title+'</div>';
    if(cfg.subtitle) html+='<div class="chart-subtitle">'+cfg.subtitle+'</div>';

    const chartTypes={
      'bar-v':buildBarV, 'bar-h':buildBarH, 'stacked-bar':buildStackedBar,
      'line':buildLine, 'area':buildArea, 'donut':buildDonut, 'pie':buildDonut,
      'radar':buildRadar, 'scatter':buildScatter, 'waterfall':buildWaterfall,
      'gauge':buildGauge, 'funnel':buildFunnel, 'progress':buildProgress,
      'mixed':buildMixed, 'bubble':buildBubble, 'polar':buildPolar,
    };

    const builder=chartTypes[cfg.type];
    if(!builder){
      html+='<p style="color:#999;font-size:12px">Unknown chart type: '+cfg.type+'</p>';
      html+='</div>';
      el.innerHTML=html;
      return;
    }

    // For non-canvas charts (funnel, progress, gauge-html)
    if(cfg.type==='funnel'||cfg.type==='progress'){
      el.innerHTML=html+builder(cfg)+'</div>';
      return;
    }

    // Canvas-based charts — generous height for readability
    const canvasId='chart-'+Math.random().toString(36).substr(2,9);
    const h=cfg.height||300;
    html+='<div style="position:relative;height:'+h+'px;max-height:'+h+'px;overflow:hidden"><canvas id="'+canvasId+'"></canvas></div>';
    html+='</div>';
    el.innerHTML=html;

    const canvas=document.getElementById(canvasId);
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const chartCfg=builder(cfg);
    new Chart(ctx,chartCfg);
  }catch(e){console.warn('Chart render error:',e)}
}

/* ─── Chart Builders ─── */
const defaultOpts={
  responsive:true,
  maintainAspectRatio:false,
  animation:{duration:800,easing:'easeOutQuart'},
  plugins:{
    legend:{position:'bottom',labels:{padding:20,usePointStyle:true,pointStyle:'rectRounded',font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},color:'${P.dark}'}},
    tooltip:{backgroundColor:'rgba(17,17,17,.92)',titleFont:{size:13,weight:'600'},bodyFont:{size:12},padding:12,cornerRadius:8,displayColors:true,boxPadding:6},
    datalabels:{color:'${P.dark}',font:{weight:'600',size:12}}
  },
  scales:{
    x:{grid:{display:false},ticks:{font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},color:'${P.muted}',padding:8},border:{display:false}},
    y:{grid:{color:'#f0f1f3',drawBorder:false},ticks:{font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},color:'${P.muted}',padding:8},border:{display:false}}
  }
};

function mergeOpts(base,over){
  const r=JSON.parse(JSON.stringify(base));
  function m(t,s){for(const k in s){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){t[k]=t[k]||{};m(t[k],s[k])}else{t[k]=s[k]}}}
  m(r,over);return r;
}

function buildBarV(cfg){
  const data=cfg.data||[];
  return{
    type:'bar',
    data:{
      labels:data.map(d=>d.label),
      datasets:[{
        data:data.map(d=>d.value),
        backgroundColor:data.map((d,i)=>d.color||CHART_COLORS[i%CHART_COLORS.length]),
        borderRadius:6,
        borderSkipped:false,
        maxBarThickness:56,
        barPercentage:0.7,
      }]
    },
    options:mergeOpts(defaultOpts,{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}})
  };
}

function buildBarH(cfg){
  const data=cfg.data||[];
  return{
    type:'bar',
    data:{
      labels:data.map(d=>d.label),
      datasets:[{
        data:data.map(d=>d.value),
        backgroundColor:data.map((d,i)=>d.color||CHART_COLORS[i%CHART_COLORS.length]),
        borderRadius:6,
        borderSkipped:false,
        maxBarThickness:36,
        barPercentage:0.65,
      }]
    },
    options:mergeOpts(defaultOpts,{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}})
  };
}

function buildStackedBar(cfg){
  const data=cfg.data||[];const series=cfg.series||[];
  return{
    type:'bar',
    data:{
      labels:data.map(d=>d.label),
      datasets:series.map((sr,si)=>({
        label:sr.name||sr.key,
        data:data.map(d=>d[sr.key]||0),
        backgroundColor:sr.color||CHART_COLORS[si%CHART_COLORS.length],
        borderRadius:si===series.length-1?{topLeft:4,topRight:4}:0,
        borderSkipped:false,
      }))
    },
    options:mergeOpts(defaultOpts,{scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}})
  };
}

function buildLine(cfg){
  const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||'Value'}];
  return{
    type:'line',
    data:{
      labels:datasets[0].data.map(d=>d.label),
      datasets:datasets.map((ds,di)=>({
        label:ds.label||'',
        data:ds.data.map(d=>d.value),
        borderColor:ds.color||CHART_COLORS[di%CHART_COLORS.length],
        backgroundColor:'transparent',
        borderWidth:2.5,
        pointRadius:4,
        pointHoverRadius:6,
        pointBackgroundColor:ds.color||CHART_COLORS[di%CHART_COLORS.length],
        pointBorderColor:'#fff',
        pointBorderWidth:2,
        tension:cfg.smooth?0.4:0.1,
      }))
    },
    options:mergeOpts(defaultOpts,{scales:{y:{beginAtZero:cfg.beginAtZero!==false}},plugins:{legend:{display:datasets.length>1}}})
  };
}

function buildArea(cfg){
  const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||'Value'}];
  return{
    type:'line',
    data:{
      labels:datasets[0].data.map(d=>d.label),
      datasets:datasets.map((ds,di)=>{
        const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];
        return{
          label:ds.label||'',
          data:ds.data.map(d=>d.value),
          borderColor:color,
          backgroundColor:hexToRgba(color,0.15),
          borderWidth:2,
          fill:true,
          pointRadius:3,
          pointHoverRadius:5,
          pointBackgroundColor:color,
          pointBorderColor:'#fff',
          pointBorderWidth:2,
          tension:cfg.smooth?0.4:0.2,
        };
      })
    },
    options:mergeOpts(defaultOpts,{scales:{y:{beginAtZero:true}},plugins:{legend:{display:datasets.length>1}}})
  };
}

function buildDonut(cfg){
  const data=cfg.data||[];const isPie=cfg.type==='pie';
  const chartData={
    type:'doughnut',
    data:{
      labels:data.map(d=>d.label),
      datasets:[{
        data:data.map(d=>d.value),
        backgroundColor:data.map((d,i)=>d.color||CHART_COLORS[i%CHART_COLORS.length]),
        borderWidth:2,
        borderColor:'#fff',
        hoverOffset:8,
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      cutout:isPie?0:'62%',
      plugins:{
        legend:{position:'right',labels:{padding:14,usePointStyle:true,pointStyle:'rectRounded',font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}},
        tooltip:{backgroundColor:'rgba(17,17,17,.92)',titleFont:{size:12},bodyFont:{size:11},padding:10,cornerRadius:6}
      }
    }
  };
  // Center text plugin for donut
  if(!isPie&&(cfg.center||cfg.centerLabel)){
    chartData.plugins=[{
      id:'centerText',
      afterDraw:function(chart){
        const ctx=chart.ctx;
        const cx=chart.chartArea.left+(chart.chartArea.right-chart.chartArea.left)/2;
        const cy=chart.chartArea.top+(chart.chartArea.bottom-chart.chartArea.top)/2;
        ctx.save();
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font="800 22px 'Inter',sans-serif";ctx.fillStyle='${P.burg}';
        ctx.fillText(cfg.center||'',cx,cy-8);
        if(cfg.centerLabel){
          ctx.font="500 9px 'Inter',sans-serif";ctx.fillStyle='#6b7280';
          ctx.fillText(cfg.centerLabel.toUpperCase(),cx,cy+14);
        }
        ctx.restore();
      }
    }];
  }
  return chartData;
}

function buildRadar(cfg){
  const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||'Score'}];
  return{
    type:'radar',
    data:{
      labels:cfg.labels||datasets[0].data.map(d=>d.label),
      datasets:datasets.map((ds,di)=>{
        const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];
        return{
          label:ds.label||'',
          data:ds.data.map(d=>typeof d==='number'?d:d.value),
          borderColor:color,
          backgroundColor:hexToRgba(color,0.15),
          borderWidth:2,
          pointRadius:4,
          pointBackgroundColor:color,
          pointBorderColor:'#fff',
          pointBorderWidth:2,
        };
      })
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{r:{beginAtZero:true,grid:{color:'#e8eaed'},angleLines:{color:'#e8eaed'},pointLabels:{font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},color:'#374151'},ticks:{display:false}}},
      plugins:{
        legend:{position:'bottom',labels:{padding:16,usePointStyle:true,font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}},
        tooltip:{backgroundColor:'rgba(17,17,17,.92)',bodyFont:{size:11},padding:10,cornerRadius:6}
      }
    }
  };
}

function buildScatter(cfg){
  const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||''}];
  return{
    type:'scatter',
    data:{
      datasets:datasets.map((ds,di)=>{
        const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];
        return{
          label:ds.label||'',
          data:ds.data.map(d=>({x:d.x,y:d.y})),
          backgroundColor:hexToRgba(color,0.7),
          borderColor:color,
          borderWidth:1.5,
          pointRadius:ds.pointSize||5,
          pointHoverRadius:(ds.pointSize||5)+2,
        };
      })
    },
    options:mergeOpts(defaultOpts,{
      scales:{
        x:{title:{display:!!cfg.xLabel,text:cfg.xLabel||'',font:{size:11,weight:'600'}}},
        y:{title:{display:!!cfg.yLabel,text:cfg.yLabel||'',font:{size:11,weight:'600'}},beginAtZero:true}
      },
      plugins:{legend:{display:datasets.length>1}}
    })
  };
}

function buildBubble(cfg){
  const datasets=cfg.datasets||[{data:cfg.data||[],label:cfg.label||''}];
  return{
    type:'bubble',
    data:{
      datasets:datasets.map((ds,di)=>{
        const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];
        return{
          label:ds.label||'',
          data:ds.data.map(d=>({x:d.x,y:d.y,r:d.r||d.size||8})),
          backgroundColor:hexToRgba(color,0.5),
          borderColor:color,
          borderWidth:1.5,
        };
      })
    },
    options:mergeOpts(defaultOpts,{
      scales:{
        x:{title:{display:!!cfg.xLabel,text:cfg.xLabel||''}},
        y:{title:{display:!!cfg.yLabel,text:cfg.yLabel||''},beginAtZero:true}
      }
    })
  };
}

function buildPolar(cfg){
  const data=cfg.data||[];
  return{
    type:'polarArea',
    data:{
      labels:data.map(d=>d.label),
      datasets:[{
        data:data.map(d=>d.value),
        backgroundColor:data.map((d,i)=>hexToRgba(d.color||CHART_COLORS[i%CHART_COLORS.length],0.65)),
        borderWidth:2,
        borderColor:'#fff',
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{position:'right',labels:{padding:14,usePointStyle:true,font:{size:12,family:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}},
        tooltip:{backgroundColor:'rgba(17,17,17,.92)',bodyFont:{size:11},padding:10,cornerRadius:6}
      },
      scales:{r:{beginAtZero:true,grid:{color:'#e8eaed'},ticks:{display:false}}}
    }
  };
}

function buildWaterfall(cfg){
  // Waterfall via floating bar chart
  const data=cfg.data||[];
  let running=0;
  const starts=[];const ends=[];const colors=[];
  data.forEach(d=>{
    if(d.total!=null){starts.push(0);ends.push(d.total);colors.push('${P.burg}');running=d.total;}
    else{starts.push(running);running+=d.value;ends.push(running);colors.push(d.value>=0?'${P.green}':'#dc2626');}
  });
  return{
    type:'bar',
    data:{
      labels:data.map(d=>d.label),
      datasets:[
        {data:starts,backgroundColor:'transparent',borderWidth:0,barPercentage:0.6},
        {data:ends.map((e,i)=>Math.abs(e-starts[i])),backgroundColor:colors,borderRadius:3,borderSkipped:false,barPercentage:0.6}
      ]
    },
    options:mergeOpts(defaultOpts,{
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){if(ctx.datasetIndex===0)return null;const d=data[ctx.dataIndex];return d.total!=null?'Total: '+d.total:(d.value>=0?'+':'')+d.value;}}}},
      scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}
    })
  };
}

function buildMixed(cfg){
  // Mixed chart: each dataset specifies its own type
  const datasets=cfg.datasets||[];
  return{
    type:'bar',
    data:{
      labels:cfg.labels||[],
      datasets:datasets.map((ds,di)=>{
        const color=ds.color||CHART_COLORS[di%CHART_COLORS.length];
        const base={
          label:ds.label||'',
          data:ds.data||[],
          borderColor:color,
          backgroundColor:ds.type==='line'?'transparent':hexToRgba(color,0.8),
          borderWidth:ds.type==='line'?2.5:0,
          borderRadius:ds.type==='line'?0:4,
          type:ds.type||'bar',
          order:ds.type==='line'?0:1,
          yAxisID:ds.yAxis||'y',
        };
        if(ds.type==='line'){
          base.pointRadius=4;base.pointBackgroundColor=color;
          base.pointBorderColor='#fff';base.pointBorderWidth=2;
          base.tension=0.2;
        }
        return base;
      })
    },
    options:mergeOpts(defaultOpts,{
      scales:{
        y:{beginAtZero:true,position:'left'},
        y1:cfg.y1Label?{beginAtZero:true,position:'right',grid:{display:false},title:{display:true,text:cfg.y1Label,font:{size:11}}}:undefined
      }
    })
  };
}

/* ─── Non-canvas: Funnel ─── */
function buildFunnel(cfg){
  const data=cfg.data||[];
  const max=Math.max(...data.map(d=>d.value));
  return data.map((d,i)=>{
    const pct=Math.max(30,(d.value/max)*100);
    const color=d.color||CHART_COLORS[i%CHART_COLORS.length];
    return '<div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">'
      +'<div style="width:90px;text-align:right;font-size:12px;font-weight:600;color:#374151;flex-shrink:0">'+d.label+'</div>'
      +'<div style="flex:1;height:32px;background:#f0f1f3;border-radius:4px;overflow:hidden;position:relative">'
      +'<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;transition:width .6s ease">'
      +'<span style="font-size:11px;font-weight:700;color:#fff">'+d.value.toLocaleString()+'</span>'
      +'</div></div></div>';
  }).join('');
}

/* ─── Non-canvas: Progress Bars ─── */
function buildProgress(cfg){
  const data=cfg.data||[];
  const max=cfg.max||100;
  return '<div class="progress-group">'+data.map((d,i)=>{
    const pct=Math.min(100,(d.value/max)*100);
    const color=d.color||CHART_COLORS[i%CHART_COLORS.length];
    return '<div class="progress-item">'
      +'<div class="prog-header"><span class="prog-label">'+d.label+'</span><span class="prog-value" style="color:'+color+'">'+d.value+(cfg.unit||'%')+'</span></div>'
      +'<div class="prog-track"><div class="prog-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'
      +'</div>';
  }).join('')+'</div>';
}

/* ─── Non-canvas: Gauge ─── */
function buildGauge(cfg){
  // Render gauge as a donut chart with custom options
  const val=cfg.value||0;const max=cfg.max||100;const pct=Math.min(100,(val/max)*100);
  const color=cfg.color||'${P.burg}';
  const canvasId='gauge-'+Math.random().toString(36).substr(2,9);
  setTimeout(()=>{
    const canvas=document.getElementById(canvasId);
    if(!canvas)return;
    new Chart(canvas.getContext('2d'),{
      type:'doughnut',
      data:{datasets:[{data:[pct,100-pct],backgroundColor:[color,'#f0f1f3'],borderWidth:0,circumference:180,rotation:270}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'75%',plugins:{legend:{display:false},tooltip:{enabled:false}}},
      plugins:[{id:'gaugeText',afterDraw:function(chart){
        const ctx=chart.ctx;const cx=(chart.chartArea.left+chart.chartArea.right)/2;const cy=chart.chartArea.bottom-10;
        ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font="800 20px 'Inter',sans-serif";ctx.fillStyle=color;
        ctx.fillText(cfg.display||val+(cfg.unit||'%'),cx,cy);
        ctx.restore();
      }}]
    });
  },100);
  return '<canvas id="'+canvasId+'" height="100" style="max-width:160px;margin:0 auto;display:block"></canvas>'
    +(cfg.label?'<div style="text-align:center;font-size:10px;color:#6b7280;margin-top:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:500">'+cfg.label+'</div>':'');
}

function renderAllCharts(){
  document.querySelectorAll('.auto-chart:not([data-rendered])').forEach(renderOneChart);
}
document.addEventListener('DOMContentLoaded',renderAllCharts);
<\/script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// JSON → HTML Renderer — deterministic, consistent, beautiful output
// The AI outputs structured JSON blocks; this code controls 100% of the
// visual rendering, guaranteeing perfect consistency across chunks.
// ═══════════════════════════════════════════════════════════════════════

const CHART_COLORS_ARR = [P.chart1, P.chart2, P.chart3, P.chart4, P.chart5, P.chart6, P.chart7, P.chart8];

function esc(s) { return escapeHTML(s); }

function renderBlock(block) {
  if (!block || !block.type) return '';
  const t = block.type;

  // ── Heading ──
  if (t === 'heading') {
    const tag = block.level === 3 ? 'h3' : 'h2';
    const labelHtml = block.label ? `<div class="block-label">${esc(block.label)}</div>` : '';
    return `${labelHtml}<${tag}>${esc(block.text)}</${tag}>`;
  }

  // ── Paragraph ──
  if (t === 'paragraph' || t === 'text') {
    const text = (block.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return `<p>${text}</p>`;
  }

  // ── List (bullet / numbered) ──
  if (t === 'list') {
    const ordered = block.ordered || false;
    const tag = ordered ? 'ol' : 'ul';
    const items = (block.items || []).map(item => {
      if (typeof item === 'string') return `<li>${item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`;
      return `<li><strong>${esc(item.title || '')}</strong>${item.text ? ' — ' + item.text : ''}</li>`;
    }).join('\n');
    return `<${tag}>${items}</${tag}>`;
  }

  // ── Consulting numbered list ──
  if (t === 'numbered-list' || t === 'num-list') {
    const items = (block.items || []).map((item, i) => {
      const title = typeof item === 'string' ? item : (item.title || '');
      const desc = typeof item === 'string' ? '' : (item.text || '');
      return `<li><span class="num-box">${i + 1}</span><span class="num-text"><strong>${esc(title)}</strong>${desc ? ' — ' + desc : ''}</span></li>`;
    }).join('\n');
    return `<ul class="num-list">${items}</ul>`;
  }

  // ── Metrics row ──
  if (t === 'metrics' || t === 'metric-row' || t === 'kpis') {
    const cards = (block.items || []).map(m => {
      let deltaHtml = '';
      if (m.delta) {
        const cls = m.delta.startsWith('+') || m.delta.startsWith('↑') ? 'up' : m.delta.startsWith('-') || m.delta.startsWith('↓') ? 'down' : 'flat';
        deltaHtml = `<div class="mc-delta ${cls}">${esc(m.delta)}</div>`;
      }
      return `<div class="metric-card"><div class="mc-value">${esc(m.value)}</div><div class="mc-label">${esc(m.label)}</div>${deltaHtml}</div>`;
    }).join('\n');
    return `<div class="metric-row">${cards}</div>`;
  }

  // ── Chart (Chart.js via auto-chart) — with smart sizing ──
  if (t === 'chart') {
    const chartType = block.chartType || 'bar-v';
    const dataLen = (block.data || []).length;
    const datasetsLen = (block.datasets || []).length;

    // Smart height: smaller charts for less data
    let height = block.height || 320;
    if (!block.height) {
      if (chartType === 'donut' || chartType === 'pie' || chartType === 'polar') height = 280;
      if (chartType === 'gauge') height = 180;
      if (chartType === 'radar') height = 300;
      if (chartType === 'bar-h' && dataLen <= 3) height = 200;
    }

    // Smart width class: don't stretch tiny bar charts full width
    let sizeClass = '';
    if (chartType === 'bar-v' && dataLen <= 3) sizeClass = 'chart-sm chart-centered';
    else if (chartType === 'bar-v' && dataLen <= 5) sizeClass = 'chart-md chart-centered';
    else if ((chartType === 'donut' || chartType === 'pie') && dataLen <= 4) sizeClass = 'chart-md chart-centered';
    else if (chartType === 'gauge') sizeClass = 'chart-sm chart-centered';

    const chartJSON = JSON.stringify({
      type: chartType,
      title: block.title || '',
      subtitle: block.subtitle || '',
      data: block.data || [],
      datasets: block.datasets || undefined,
      labels: block.labels || undefined,
      series: block.series || undefined,
      center: block.center || undefined,
      centerLabel: block.centerLabel || undefined,
      height,
      smooth: block.smooth || false,
      xLabel: block.xLabel || undefined,
      yLabel: block.yLabel || undefined,
      max: block.max || undefined,
      unit: block.unit || undefined,
    }).replace(/'/g, '&#39;');
    return `<div class="auto-chart ${sizeClass}" data-chart='${chartJSON}'></div>`;
  }

  // ── Table ──
  if (t === 'table') {
    const headers = (block.headers || []).map(h => `<th>${esc(h)}</th>`).join('');
    const rows = (block.rows || []).map(row => {
      const cells = row.map((cell, ci) => {
        const isNum = ci > 0 && /^[\$€£¥]?[\d,.]+[%xX]?$/.test(String(cell).trim());
        return `<td${isNum ? ' class="num"' : ''}>${esc(String(cell))}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ── Key finding ──
  if (t === 'key-finding' || t === 'finding') {
    const label = block.label || 'Key Finding';
    return `<div class="key-finding"><div class="kf-label">${esc(label)}</div><p>${block.text || ''}</p></div>`;
  }

  // ── Callout (blue, green, amber, teal) ──
  if (t === 'callout') {
    const variant = block.variant || 'blue';
    const label = block.label || (variant === 'green' ? 'Insight' : variant === 'amber' ? 'Note' : variant === 'teal' ? 'Tip' : 'Note');
    return `<div class="callout ${variant}"><div class="callout-label">${esc(label)}</div><p>${block.text || ''}</p></div>`;
  }

  // ── Stat highlight (big number + context) ──
  if (t === 'stat-highlight' || t === 'stat') {
    return `<div class="stat-highlight"><div class="stat-big">${esc(block.value)}</div><div class="stat-text">${block.text || ''}</div></div>`;
  }

  // ── Quote ──
  if (t === 'quote') {
    const attr = block.attribution ? `<div style="margin-top:10px;font-size:12px;font-weight:600;color:${P.muted}">— ${esc(block.attribution)}</div>` : '';
    return `<div class="key-finding" style="border-left-color:${P.info}"><p style="font-style:italic;font-size:15px;line-height:1.7">${block.text || ''}</p>${attr}</div>`;
  }

  // ── Cards (stacked vertically) ──
  if (t === 'cards') {
    const cards = (block.items || []).map(c => {
      const body = (c.bullets || []).length > 0
        ? '<ul>' + c.bullets.map(b => `<li>${b.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`).join('') + '</ul>'
        : (c.text ? `<div class="card-text">${c.text}</div>` : '');
      const tagHtml = c.tag ? `<span class="tag ${c.tagColor || 'blue'}">${esc(c.tag)}</span>` : '';
      return `<div class="card bordered-top">${tagHtml}<div class="card-title">${esc(c.title || '')}</div>${body}</div>`;
    }).join('\n');
    return `<div class="stack">${cards}</div>`;
  }

  // ── Timeline ──
  if (t === 'timeline') {
    const items = (block.items || []).map(item => {
      const activeClass = item.active ? ' active' : '';
      return `<div class="timeline-item${activeClass}"><div class="tl-date">${esc(item.date || item.phase || '')}</div><div class="tl-title">${esc(item.title || '')}</div><div class="tl-desc">${item.text || ''}</div></div>`;
    }).join('\n');
    return `<div class="timeline">${items}</div>`;
  }

  // ── Progress bars ──
  if (t === 'progress') {
    const items = (block.items || []).map((d, i) => {
      const pct = Math.min(100, (d.value / (block.max || 100)) * 100);
      const color = d.color || CHART_COLORS_ARR[i % CHART_COLORS_ARR.length];
      return `<div class="progress-item"><div class="prog-header"><span class="prog-label">${esc(d.label)}</span><span class="prog-value" style="color:${color}">${d.value}${block.unit || '%'}</span></div><div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
    }).join('\n');
    return `<div class="progress-group">${items}</div>`;
  }

  // ── Chevron / Process flow ──
  if (t === 'process' || t === 'chevron-flow') {
    const items = (block.items || []).map((d, i) => {
      const activeClass = d.active ? ' active' : '';
      return `<div class="chevron${activeClass}"><div class="chev-num">${String(i + 1).padStart(2, '0')}</div><div class="chev-title">${esc(d.title || '')}</div><div class="chev-desc">${d.text || ''}</div></div>`;
    }).join('\n');
    return `<div class="chevron-flow">${items}</div>`;
  }

  // ── Comparison cards (stacked) ──
  if (t === 'comparison') {
    const cards = (block.items || []).map(c => {
      const body = (c.bullets || []).length > 0
        ? '<ul>' + c.bullets.map(b => `<li>${b}</li>`).join('') + '</ul>'
        : (c.text ? `<p>${c.text}</p>` : '');
      return `<div class="compare-card"><h5>${esc(c.title || '')}</h5>${body}</div>`;
    }).join('\n');
    return `<div class="stack">${cards}</div>`;
  }

  // ── Divider ──
  if (t === 'divider') {
    return '<div class="h-divider"></div>';
  }

  // ── Visual separator (decorative) ──
  if (t === 'separator' || t === 'visual-separator') {
    const icon = block.icon || '◆';
    const text = block.text || '';
    return `<div class="visual-sep"><div class="vs-line"></div>${text ? `<span class="vs-text">${esc(text)}</span>` : `<span class="vs-icon">${icon}</span>`}<div class="vs-line"></div></div>`;
  }

  // ── Sub-category header ──
  if (t === 'sub-category' || t === 'sub-heading') {
    const label = block.label || '';
    const desc = block.description || block.text || '';
    return `<div class="sub-category">${label ? `<div class="sc-label">${esc(label)}</div>` : ''}<div class="sc-title">${esc(block.title || '')}</div>${desc ? `<div class="sc-desc">${desc}</div>` : ''}</div>`;
  }

  // ── Icon cards — grid of cards with colored icons ──
  if (t === 'icon-cards' || t === 'icon-card-grid') {
    const accentColors = ['accent-red', 'accent-blue', 'accent-green', 'accent-amber', 'accent-violet', 'accent-teal'];
    const defaultIcons = ['◆', '▲', '●', '★', '◈', '▶'];
    const cards = (block.items || []).map((c, i) => {
      const accent = c.accent || accentColors[i % accentColors.length];
      const icon = c.icon || defaultIcons[i % defaultIcons.length];
      const valueHtml = c.value ? `<div class="ic-value">${esc(c.value)}</div>` : '';
      return `<div class="icon-card ${accent}"><div class="ic-icon">${icon}</div><div class="ic-body">${valueHtml}<div class="ic-title">${esc(c.title || '')}</div><div class="ic-text">${c.text || ''}</div></div></div>`;
    }).join('\n');
    return `<div class="icon-cards">${cards}</div>`;
  }

  // ── Highlight box — gradient accent banner with big stat ──
  if (t === 'highlight-box' || t === 'highlight') {
    const label = block.label || '';
    const value = block.value || '';
    const text = block.text || '';
    return `<div class="highlight-box">${label ? `<div class="hb-label">${esc(label)}</div>` : ''}${value ? `<div class="hb-value">${esc(value)}</div>` : ''}<div class="hb-text">${text}</div></div>`;
  }

  // ── Matrix (2×2 quadrant) ──
  if (t === 'matrix') {
    const cells = (block.cells || block.items || []).slice(0, 4);
    const quadrantLabels = block.quadrants || ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
    const cellsHtml = cells.map((c, i) => {
      const iconHtml = c.icon ? `<span class="mx-icon">${c.icon}</span>` : '';
      const label = c.quadrant || quadrantLabels[i] || '';
      return `<div class="matrix-cell">${iconHtml}<div class="mx-quadrant">${esc(label)}</div><div class="mx-title">${esc(c.title || '')}</div><div class="mx-desc">${c.text || ''}</div></div>`;
    }).join('\n');
    const axisHtml = block.xAxis || block.yAxis
      ? `<div class="matrix-labels">${block.xAxis ? `<span>← ${esc(block.xAxis)} →</span>` : ''}${block.yAxis ? `<span>↑ ${esc(block.yAxis)} ↓</span>` : ''}</div>` : '';
    return `<div class="matrix-grid">${cellsHtml}</div>${axisHtml}`;
  }

  // ── Pill list — horizontal tags ──
  if (t === 'pill-list' || t === 'pills' || t === 'tags') {
    const items = (block.items || []).map(item => {
      const label = typeof item === 'string' ? item : item.text || item.label || '';
      const color = typeof item === 'string' ? 'accent' : (item.color || 'accent');
      return `<span class="pill ${color}">${esc(label)}</span>`;
    }).join('\n');
    return `<div class="pill-list">${items}</div>`;
  }

  // ── Scorecard row — metrics with status indicators ──
  if (t === 'scorecards' || t === 'scorecard') {
    const cards = (block.items || []).map((c, i) => {
      const color = c.color || CHART_COLORS_ARR[i % CHART_COLORS_ARR.length];
      const statusCls = c.status === 'good' || c.status === 'green' ? 'good' : c.status === 'warn' || c.status === 'amber' ? 'warn' : c.status === 'bad' || c.status === 'red' ? 'bad' : '';
      const statusHtml = c.statusText ? `<div class="sc-status ${statusCls}">${esc(c.statusText)}</div>` : '';
      return `<div class="scorecard"><div class="sc-bar" style="background:${color}"></div><div class="sc-value">${esc(c.value || '')}</div><div class="sc-label">${esc(c.label || '')}</div>${statusHtml}</div>`;
    }).join('\n');
    return `<div class="scorecard-row">${cards}</div>`;
  }

  // ── Grid layout — renders child blocks in columns ──
  if (t === 'grid') {
    const cols = block.columns || 2;
    const gridClass = cols === 3 ? 'grid-3' : cols === 4 ? 'grid-4' : 'grid-2';
    const children = (block.items || block.blocks || []).map(child => `<div>${renderBlock(child)}</div>`).join('\n');
    return `<div class="${gridClass}">${children}</div>`;
  }

  // ── Source note ──
  if (t === 'source') {
    return `<div class="source-note">${esc(block.text || '')}</div>`;
  }

  // ── Fallback: raw HTML passthrough ──
  if (t === 'html') {
    return block.content || block.html || '';
  }

  return `<!-- unknown block type: ${esc(t)} -->`;
}

/**
 * Render an array of blocks into an HTML string.
 * This is the core engine: AI outputs JSON blocks, this produces
 * pixel-perfect HTML every time, same styling regardless of model.
 */
function renderBlocksToHTML(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map(renderBlock).join('\n');
}

/**
 * Render a full section from JSON structure.
 * Each section has: { title, subtitle?, blocks: [...] }
 */
function renderSectionFromJSON(section) {
  const blocks = section.blocks || section.content || [];
  return renderBlocksToHTML(blocks);
}

// ─── Build the prompt — structure + freedom ───
function buildReportPrompt({ plan, knowledge, understanding, settings }) {
  const sections = plan?.sections || [];
  const sectionNames = sections.map((s, i) => {
    const title = s.sectionTitle || s.title || s.name || `Section ${i + 1}`;
    const slides = (s.slides || []).map(sl => sl.title || '').filter(Boolean);
    return `${i + 1}. ${title}${slides.length > 0 ? ` (${slides.join(', ')})` : ''}`;
  });

  const mainMessage = plan?.mainMessage || plan?.governingThought || understanding?.governingThought || understanding?.topic || '';
  const audience = understanding?.audience || 'business professionals';
  const fullAsk = understanding?.fullClientAsk || understanding?.topic || '';
  const narrativeArc = understanding?.narrativeArc || plan?.storylineType || '';
  const narrativeFlow = understanding?.narrativeFlow || plan?.storylineFlow || '';
  const toneGuidance = understanding?.toneGuidance || plan?.toneDirection || '';
  const requirementsBrief = understanding?.requirementsBrief || '';

  // Build compiled content — prefer narrative text (rich story), fall back to JSON slides
  const compiledNarrative = plan?.compiledNarrative || '';
  const compiledSlides = plan?.compiledSlides || [];
  let compiledContext = '';
  if (compiledNarrative) {
    // Rich narrative text — the full compiled story from the manager
    compiledContext = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPILED REPORT CONTENT — the full narrative (this IS the story, render it faithfully):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${compiledNarrative}
`;
  } else if (compiledSlides.length > 0) {
    // Fallback: structured JSON slides
    compiledContext = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPROVED SLIDE CONTENT — the agreed story (follow this narrative):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${compiledSlides.map((s, i) => {
  let text = `${i + 1}. [${s.contentType || 'content'}] ${s.title} — Section: ${s.section || '(general)'}`;
  if (s.keyMessage) text += `\n   Key Message: ${s.keyMessage}`;
  if (s.dataPoints?.length > 0) text += `\n   Data: ${s.dataPoints.join(' | ')}`;
  if (s.instruction) text += `\n   Content: ${s.instruction}`;
  return text;
}).join('\n\n')}
`;
  }

  const reportTitle = mainMessage || understanding?.topic || 'Research Report';

  return `Create a complete, visually stunning HTML report. Output ONLY the HTML — no explanation, no markdown.

CLIENT ASK: ${fullAsk}
AUDIENCE: ${audience}
${mainMessage ? `GOVERNING THOUGHT: ${mainMessage}` : ''}
${narrativeArc ? `NARRATIVE ARC: ${narrativeArc}${narrativeFlow ? ` — ${narrativeFlow}` : ''}` : ''}
${toneGuidance ? `TONE: ${toneGuidance}` : ''}
${requirementsBrief ? `REQUIREMENTS: ${requirementsBrief}` : ''}

SECTIONS:
${sectionNames.join('\n')}
${compiledContext}
RESEARCH:
${knowledge}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT: A COMPLETE HTML PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output a complete <!DOCTYPE html> page with:
• Embedded <style> in <head> (all CSS inline in the document)
• Professional layout: header, navigation/sidebar, content area
• Each SECTION as a navigable tab or page section
• Beautiful, magazine-quality design

COLOR PALETTE:
  Primary: #8E1E1E (burgundy) | Accent: #d4a574 (warm gold)
  Blue: #4f46e5 | Teal: #0d9488 | Amber: #d97706 | Green: #16a34a
  Slate: #64748b | Black: #111111 | Light grey: #E6E9EE | Off-white: #F7F9FB

CHARTS — Chart.js is available (included automatically). Create beautiful, interactive charts:
  • Use Chart.js directly with <canvas> elements and inline <script> blocks
  • Choose the best chart type for each data story (bar, line, doughnut, radar, etc.)
  • Style charts to match the color palette — use gradients, animations, hover effects
  • Use REAL data from RESEARCH — never placeholders like [1,2,3,4]
  • Make charts visually impressive — this is a premium report

BE AESTHETIC:
  • Gradients, shadows, rounded corners, modern typography
  • Visual hierarchy with size, color, weight, spacing
  • Flexbox/grid layouts
  • Cards, callout boxes, metric displays, tables with hover states
  • Think Stripe, Linear, McKinsey-quality design

${getWorkLevelInstructions(settings?.workLevelReport, 'report')}

IMPORTANT:
• Use ALL data from RESEARCH — every insight, every number
• Include tab/section navigation with JavaScript
• Output starts with <!DOCTYPE html> and ends with </html>
• No markdown, no \`\`\`, no explanation — just the HTML`;
}

// ─── Helper: chunk array into N parts ───
function chunkArray(arr, numChunks) {
  const result = [];
  const chunkSize = Math.ceil(arr.length / numChunks);
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════════
// JSON-MODE prompts — AI outputs structured JSON, we render HTML
// ═══════════════════════════════════════════════════════════════════════

const JSON_BLOCK_SCHEMA = `You output JSON arrays of content blocks. Each block has a "type" and type-specific fields.

═══ BLOCK TYPES ═══

── TEXT & STRUCTURE ──

1. heading — Section heading
   {"type":"heading","text":"Title Here","level":2}
   {"type":"heading","text":"Sub-heading","level":3,"label":"OPTIONAL LABEL"}

2. sub-category — Visual sub-section divider (use to break sections into themed parts)
   {"type":"sub-category","title":"Market Dynamics","label":"PART A","description":"How competitive forces shape the landscape"}

3. paragraph — Body text (supports **bold** markdown)
   {"type":"paragraph","text":"Analysis shows that **key finding** is significant."}

4. list — Bullet or numbered list
   {"type":"list","items":["First point","Second point","Third point"]}
   {"type":"list","ordered":true,"items":[{"title":"Step 1","text":"Description"},{"title":"Step 2","text":"Description"}]}

── DATA VISUALIZATION ──

5. metrics — KPI cards row (2-5 items)
   {"type":"metrics","items":[{"value":"$12M","label":"Annual Savings","delta":"+23%"},{"value":"3.2x","label":"ROI","delta":"+18%"}]}

6. chart — Interactive Chart.js chart (VARY THE CHART TYPES — don't just use bar-v!)
   Bar:        {"type":"chart","chartType":"bar-v","title":"Revenue by Region","data":[{"label":"North","value":45},{"label":"South","value":32}]}
   Horizontal: {"type":"chart","chartType":"bar-h","title":"Market Share","data":[{"label":"Us","value":35},{"label":"Competitor","value":28}]}
   Line:       {"type":"chart","chartType":"line","title":"Trend Over Time","data":[{"label":"Q1","value":10},{"label":"Q2","value":25},{"label":"Q3","value":38}]}
   Area:       {"type":"chart","chartType":"area","title":"Growth Trajectory","data":[{"label":"Jan","value":5},{"label":"Mar","value":18},{"label":"Jun","value":40}],"smooth":true}
   Donut:      {"type":"chart","chartType":"donut","title":"Allocation","center":"$8.4M","centerLabel":"Total","data":[{"label":"Infra","value":35},{"label":"Talent","value":25},{"label":"R&D","value":20},{"label":"Other","value":20}]}
   Radar:      {"type":"chart","chartType":"radar","title":"Capability Assessment","data":[{"label":"Speed","value":8},{"label":"Quality","value":7},{"label":"Cost","value":6},{"label":"Scale","value":9}]}
   Stacked:    {"type":"chart","chartType":"stacked-bar","title":"Breakdown","data":[{"label":"Q1","a":10,"b":20},{"label":"Q2","a":15,"b":25}],"series":[{"key":"a","name":"Product A"},{"key":"b","name":"Product B"}]}
   Multi-line: {"type":"chart","chartType":"line","title":"Comparison","datasets":[{"label":"2024","data":[{"label":"Q1","value":10},{"label":"Q2","value":20}]},{"label":"2025","data":[{"label":"Q1","value":15},{"label":"Q2","value":30}]}]}
   Waterfall:  {"type":"chart","chartType":"waterfall","title":"Bridge Analysis","data":[{"label":"Start","total":100},{"label":"Growth","value":30},{"label":"Costs","value":-15},{"label":"End","total":115}]}
   Scatter:    {"type":"chart","chartType":"scatter","title":"Correlation","xLabel":"Investment","yLabel":"Return","data":[{"x":10,"y":15},{"x":25,"y":40}]}
   Gauge:      {"type":"chart","chartType":"gauge","title":"","value":75,"max":100,"label":"Completion","color":"#059669"}
   Polar:      {"type":"chart","chartType":"polar","title":"Distribution","data":[{"label":"A","value":30},{"label":"B","value":45},{"label":"C","value":20}]}

7. table — Data table
   {"type":"table","headers":["Category","Value","Change"],"rows":[["Revenue","$45M","+12%"],["Costs","$28M","-5%"]]}

8. scorecards — Metrics with colored status bars
   {"type":"scorecards","items":[{"value":"94%","label":"Uptime","status":"good","statusText":"On Track","color":"#059669"},{"value":"67%","label":"Adoption","status":"warn","statusText":"Needs Attention","color":"#D97706"}]}

── INSIGHTS & HIGHLIGHTS ──

9. key-finding — Highlighted insight box
   {"type":"key-finding","text":"The analysis reveals that AI adoption correlates with 3.2x ROI.","label":"Key Finding"}

10. callout — Colored note box (variant: blue|green|amber|teal)
    {"type":"callout","variant":"green","label":"Insight","text":"Customer satisfaction improved 23% after deployment."}

11. stat-highlight — Big number with context
    {"type":"stat-highlight","value":"47%","text":"Reduction in manual processing time, freeing **12,000+ staff-hours** annually."}

12. highlight-box — Gradient accent banner for standout insights
    {"type":"highlight-box","label":"HEADLINE FINDING","value":"3.2×","text":"Return on AI investment across all divisions, exceeding the industry benchmark of 2.1×."}

13. quote — Quote block
    {"type":"quote","text":"AI transformation isn't about technology — it's about people.","attribution":"CEO, TechCorp"}

── VISUAL CARDS & LAYOUTS ──

14. icon-cards — Grid of cards with colored icons (great for capabilities, pillars, recommendations)
    {"type":"icon-cards","items":[{"icon":"⚡","title":"Speed","text":"40% faster processing","accent":"accent-amber"},{"icon":"🎯","title":"Accuracy","text":"99.2% precision rate","accent":"accent-green","value":"99.2%"},{"icon":"📊","title":"Scale","text":"10x throughput increase","accent":"accent-blue"}]}

15. cards — Stacked content cards
    {"type":"cards","items":[{"title":"Card Title","tag":"Phase 1","tagColor":"blue","bullets":["Point one","Point two"]},{"title":"Another","text":"Description text"}]}

16. matrix — 2×2 quadrant diagram (great for strategic positioning)
    {"type":"matrix","xAxis":"Effort","yAxis":"Impact","cells":[{"quadrant":"High Impact / Low Effort","title":"Quick Wins","text":"Immediate automation","icon":"⚡"},{"quadrant":"High Impact / High Effort","title":"Strategic Bets","text":"Platform migration","icon":"🎯"},{"quadrant":"Low Impact / Low Effort","title":"Fill-ins","text":"Minor optimizations","icon":"◆"},{"quadrant":"Low Impact / High Effort","title":"Deprioritize","text":"Legacy rebuilds","icon":"⏸"}]}

17. comparison — Comparison cards
    {"type":"comparison","items":[{"title":"Before","bullets":["Manual processes","3-day turnaround"]},{"title":"After","bullets":["Automated workflows","Real-time processing"]}]}

── PROCESS & PROGRESS ──

18. timeline — Vertical timeline
    {"type":"timeline","items":[{"date":"Q1 2025","title":"Foundation","text":"Data infrastructure setup","active":true},{"date":"Q2 2025","title":"Pilot","text":"First AI deployments"}]}

19. progress — Progress bars
    {"type":"progress","items":[{"label":"Operations","value":92},{"label":"Finance","value":65}],"max":100}

20. process — Process/chevron flow
    {"type":"process","items":[{"title":"Research","text":"Data collection"},{"title":"Analyze","text":"Pattern identification","active":true}]}

── FORMATTING & LAYOUT ──

21. grid — Multi-column layout wrapper (nest other blocks inside)
    {"type":"grid","columns":2,"items":[{"type":"chart","chartType":"donut","title":"Split","data":[...]},{"type":"list","items":["Point 1","Point 2"]}]}

22. pill-list — Horizontal tag display
    {"type":"pill-list","items":["AI/ML","Cloud","Data Analytics","Automation"]}
    {"type":"pill-list","items":[{"text":"High Priority","color":"accent"},{"text":"Low Risk","color":""}]}

23. separator — Decorative visual divider between topics
    {"type":"separator","text":"Next Section"}
    {"type":"separator","icon":"◆"}

24. divider — Simple line divider
    {"type":"divider"}

25. source — Source/footnote
    {"type":"source","text":"Source: Internal analytics dashboard, Q4 2025"}

═══ MANDATORY RULES ═══

CONTENT INTEGRITY:
- CONTENT IS TRUTH: All text, numbers, labels, and data points MUST come from the RESEARCH DATA — never from template examples above. The examples show FORMAT only. Extract every value from the actual research.
- Do NOT invent data. Do NOT use placeholder numbers. Every chart data point, every metric value, every statistic MUST be traceable to the research.

VISUAL RICHNESS (NON-NEGOTIABLE):
- NEVER produce a section with only paragraphs and lists — every section MUST have at least 2 visual elements (charts, metrics, icon-cards, scorecards, tables, highlight-box, matrix, progress, timeline, or comparison)
- Use sub-category blocks to break sections into 2-4 themed sub-parts. Sections with only top-level content look boring.
- VARY your chart types! If you've used bar-v, use line, donut, radar, area, or stacked-bar next. NEVER use more than 2 bar-v charts in the same section.
- Use icon-cards for capabilities, features, pillars, or recommendations (3-4 items each)
- Use highlight-box for the single most important finding per section
- Use scorecards when showing status/health metrics
- Use matrix for strategic positioning, prioritization, or 2-dimensional analysis

STRUCTURE:
- EVERY section MUST start with a sub-category or heading, then context paragraph, then visuals
- Break each section into 2-3 sub-categories to create visual rhythm and prevent monotony
- Produce 8-15 blocks per section (not 3-5 — be THOROUGH)
- Each sub-category within a section should have its own visual element
- End important sections with a key-finding or callout summarizing the insight

SPACING & FLOW:
- Use separator blocks between major topic shifts within a section
- Use dividers sparingly — prefer sub-category headers which look better
- Keep paragraphs to 2-3 sentences; prefer bullet lists for multiple points
- Use **bold** in text for key terms and emphasis

OUTPUT FORMAT:
- Output ONLY valid JSON — no markdown, no \`\`\`, no explanation
- Do NOT be lazy: produce COMPLETE, DETAILED content for every section. Skimpy output is unacceptable.`;

/**
 * Match knowledge entries to a section by keyword overlap.
 * Returns entries sorted by relevance (best match first).
 * If no entries match, returns ALL entries so the LLM still has data to work with.
 */
function matchResearchToSection(sectionTitle, keyMessage, slidesText, knowledgeEntries) {
  if (!knowledgeEntries?.length) return [];

  // Summary/overview/introduction sections need ALL research — they synthesize everything
  const titleLower = (sectionTitle || '').toLowerCase();
  const summaryKeywords = ['executive', 'summary', 'overview', 'introduction', 'key findings', 'highlights', 'conclusion', 'recommendations'];
  if (summaryKeywords.some(kw => titleLower.includes(kw))) {
    return knowledgeEntries;
  }

  const combinedText = `${sectionTitle} ${keyMessage} ${slidesText}`;
  const sectionWords = combinedText
    .toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (sectionWords.length === 0) return knowledgeEntries;

  // Build bigrams for multi-word matching (e.g. "market share", "supply chain")
  const bigrams = [];
  for (let i = 0; i < sectionWords.length - 1; i++) {
    bigrams.push(sectionWords[i] + ' ' + sectionWords[i + 1]);
  }

  const scored = knowledgeEntries.map(k => {
    const srcLower = (k.source || '').toLowerCase();
    const dataLower = (k.data || '').toLowerCase().slice(0, 8000);
    let score = 0;
    for (const w of sectionWords) {
      if (srcLower.includes(w)) score += 3;
      if (dataLower.includes(w)) score += 1;
    }
    for (const bg of bigrams) {
      if (srcLower.includes(bg)) score += 5;
      if (dataLower.includes(bg)) score += 3;
    }
    return { ...k, _score: score };
  }).filter(k => k._score > 0);

  scored.sort((a, b) => b._score - a._score);

  // If too few entries matched (< 3 or < 40% of total), include ALL entries.
  // Sparse matching means the section likely needs broader context.
  if (scored.length < 3 || scored.length < knowledgeEntries.length * 0.4) {
    return knowledgeEntries;
  }

  return scored;
}

function buildJSONChunkPrompt({ sections, sectionIndices, knowledge, knowledgeEntries, understanding, plan, settings }) {
  const mainMessage = understanding?.governingThought || understanding?.topic || '';
  const audience = understanding?.audience || 'business professionals';
  const fullAsk = understanding?.fullClientAsk || understanding?.topic || '';
  const narrativeArc = understanding?.narrativeArc || '';
  const narrativeFlow = understanding?.narrativeFlow || '';
  const compiledNarrative = plan?.compiledNarrative || '';

  // Build detailed section list with MATCHED worker research per section
  const sectionBlocks = sections.map((s, i) => {
    const globalIdx = sectionIndices[i];
    const title = s.sectionTitle || s.title || s.name || `Section ${globalIdx + 1}`;
    const keyMsg = s.keyMessage || '';
    const slides = (s.slides || []).map(sl => {
      const slideTitle = sl.title || sl.name || '';
      const slideKey = sl.keyMessage || '';
      return `    • ${slideTitle}${slideKey ? ` — ${slideKey}` : ''}`;
    }).join('\n');

    // Match worker research to this section by keyword overlap
    const matched = matchResearchToSection(title, keyMsg, slides, knowledgeEntries);

    let block = `═══ SECTION ${globalIdx + 1}: "${title}" ═══${keyMsg ? `\nKey message: ${keyMsg}` : ''}${slides ? '\nSub-topics:\n' + slides : ''}`;
    if (matched.length > 0) {
      block += '\n\n── CONSULTANT RESEARCH FOR THIS SECTION ──';
      for (const m of matched) {
        block += `\n\n### ${m.source}\n${m.data}`;
      }
    }
    return block;
  }).join('\n\n');

  // Any unmatched research as additional context
  const allMatchedSources = new Set();
  sections.forEach(s => {
    const title = s.sectionTitle || s.title || s.name || '';
    const keyMsg = s.keyMessage || '';
    const slides = (s.slides || []).map(sl => sl.title || '').join(' ');
    matchResearchToSection(title, keyMsg, slides, knowledgeEntries).forEach(m => allMatchedSources.add(m.source));
  });
  const unmatchedResearch = (knowledgeEntries || []).filter(k => !allMatchedSources.has(k.source));
  const additionalResearch = unmatchedResearch.length > 0
    ? `\n\n═══ ADDITIONAL RESEARCH (use where relevant) ═══\n${unmatchedResearch.map(k => `### ${k.source}\n${k.data}`).join('\n\n')}`
    : '';

  return `Generate structured JSON content for these report sections. This is a premium consulting deliverable — be THOROUGH, LONG, and VISUAL.
TODAY: ${currentDateString()}

TOPIC: ${fullAsk}
AUDIENCE: ${audience}
${mainMessage ? `GOVERNING THOUGHT: ${mainMessage}` : ''}
${narrativeArc ? `NARRATIVE ARC: ${narrativeArc}` : ''}
${narrativeFlow ? `NARRATIVE FLOW: ${narrativeFlow}` : ''}
${compiledNarrative ? `\n═══ EXECUTIVE NARRATIVE (Manager's synthesis — use for executive summary and cross-section coherence) ═══\n${compiledNarrative}\n` : ''}

Each section below includes the consultant's FULL research. Use ALL of it — every data point, every statistic, every finding. Do NOT summarize or skip data.

${sectionBlocks}
${additionalResearch}

${JSON_BLOCK_SCHEMA}

═══ OUTPUT FORMAT ═══
Return a JSON object with section keys:
{
  "section_${sectionIndices[0] + 1}": {
    "title": "Section Title",
    "subtitle": "Brief key message",
    "blocks": [ ...array of block objects... ]
  }${sectionIndices.length > 1 ? `,
  "section_${sectionIndices[1] + 1}": { ... }` : ''}
}

═══ SECTION STRUCTURE PATTERN (follow for EVERY section, 12-20 blocks each) ═══

1. sub-category block — first themed sub-part with label like "PART A"
2. paragraph — contextual opening (3-5 sentences with specific data points)
3. metrics OR scorecards — 3-5 headline numbers for this sub-part (REAL data from research)
4. chart (VARIED type!) — visualize the key data (use line, donut, radar, area — NOT always bar-v), 4+ data points
5. key-finding OR callout — the insight extracted from the data
6. separator — visual break
7. sub-category block — second themed sub-part with label like "PART B"
8. icon-cards (4-6 items) OR comparison OR matrix — visual analysis element with specific data
9. paragraph — supporting analysis (3-5 sentences)
10. table (4+ rows) OR progress — detailed evidence with real comparative data
11. If section has 3+ sub-topics: separator → sub-category → chart (different type) → paragraph → callout
12. highlight-box — standout conclusion for this section
13. source — data attribution

Every sub-topic listed under each section (bullet points above) MUST become its own sub-category with its own blocks. Do NOT skip or merge sub-topics.

═══ ANTI-LAZINESS RULES — CRITICAL ═══
- MINIMUM 12 blocks per section. Sections with fewer than 10 blocks = REJECTION.
- Every section MUST have at least 3 different visual block types (chart + icon-cards + metrics, table + scorecards + comparison, etc.)
- DO NOT produce heading → paragraph → paragraph → list. That is BORING and will be REJECTED.
- VARY chart types: if one section has bar-v, next should use line, donut, radar, area, stacked-bar, waterfall, or scatter
- Charts must have 4+ real data points from the research
- Tables must have 4+ rows of real comparative data
- Icon-cards must have 4-6 items with specific, data-backed text
- Every paragraph must be 3-5 sentences with specific data, not vague filler
- This is a PREMIUM deliverable for a paying executive client. McKinsey / BCG quality required.

${getWorkLevelInstructions(settings?.workLevelReport, 'report')}

Output ONLY valid JSON — no markdown, no \`\`\`, no explanation.`;
}

function buildJSONSingleCallPrompt({ plan, knowledge, knowledgeEntries, understanding, settings }) {
  const sections = plan?.sections || [];
  const reportTitle = understanding?.topic || plan?.mainMessage || 'Research Report';
  const mainMessage = understanding?.governingThought || understanding?.topic || '';
  const audience = understanding?.audience || 'business professionals';
  const fullAsk = understanding?.fullClientAsk || understanding?.topic || '';
  const narrativeArc = understanding?.narrativeArc || '';
  const narrativeFlow = understanding?.narrativeFlow || '';
  const compiledNarrative = plan?.compiledNarrative || '';

  // Build section list with matched worker research per section
  const sectionBlocks = sections.map((s, i) => {
    const title = s.sectionTitle || s.title || s.name || `Section ${i + 1}`;
    const key = s.keyMessage || '';
    const slides = (s.slides || []).map(sl => {
      const slideTitle = sl.title || sl.name || '';
      const slideKey = sl.keyMessage || '';
      return `     • ${slideTitle}${slideKey ? ` — ${slideKey}` : ''}`;
    }).join('\n');

    // Match worker research to this section
    const matched = matchResearchToSection(title, key, slides, knowledgeEntries);

    let block = `═══ SECTION ${i + 1}: "${title}" ═══${key ? `\nKey message: ${key}` : ''}${slides ? '\nSub-topics:\n' + slides : ''}`;
    if (matched.length > 0) {
      block += '\n\n── CONSULTANT RESEARCH ──';
      for (const m of matched) {
        block += `\n\n### ${m.source}\n${m.data}`;
      }
    }
    return block;
  }).join('\n\n');

  // Unmatched research
  const allMatchedSources = new Set();
  sections.forEach(s => {
    const title = s.sectionTitle || s.title || s.name || '';
    const key = s.keyMessage || '';
    const slides = (s.slides || []).map(sl => sl.title || '').join(' ');
    matchResearchToSection(title, key, slides, knowledgeEntries).forEach(m => allMatchedSources.add(m.source));
  });
  const unmatchedResearch = (knowledgeEntries || []).filter(k => !allMatchedSources.has(k.source));
  const additionalResearch = unmatchedResearch.length > 0
    ? `\n\n═══ ADDITIONAL RESEARCH ═══\n${unmatchedResearch.map(k => `### ${k.source}\n${k.data}`).join('\n\n')}`
    : '';

  return `Generate a complete structured JSON report. This is a PREMIUM consulting deliverable — be THOROUGH, VISUAL, LONG, and DETAILED.
TODAY: ${currentDateString()}

TITLE: ${reportTitle}
TOPIC: ${fullAsk}
AUDIENCE: ${audience}
${mainMessage ? `GOVERNING THOUGHT: ${mainMessage}` : ''}
${narrativeArc ? `NARRATIVE ARC: ${narrativeArc}` : ''}
${narrativeFlow ? `NARRATIVE FLOW: ${narrativeFlow}` : ''}
${compiledNarrative ? `\n═══ EXECUTIVE NARRATIVE (Manager's synthesis — use this for the Executive Summary section) ═══\n${compiledNarrative}\n` : ''}

Each section below includes the consultant's FULL research. Use ALL data — every data point, every statistic, every finding. Do NOT summarize or skip data. This report should be LONG and COMPREHENSIVE.

${sectionBlocks}
${additionalResearch}

${JSON_BLOCK_SCHEMA}

═══ OUTPUT FORMAT ═══
{
  "sections": [
    {
      "title": "Executive Summary",
      "subtitle": "Key takeaway in one line",
      "blocks": [ ...blocks... ]
    },
    {
      "title": "Section Title",
      "subtitle": "Key message",
      "blocks": [ ...blocks... ]
    }
  ]
}

═══ REQUIREMENTS ═══

1. EXECUTIVE SUMMARY (first section) — this is the MOST IMPORTANT section, must include:
   - highlight-box with the governing thought as a bold statement
   - metrics block with 4-6 headline KPIs from the research (real numbers only)
   - sub-category "Key Findings" with icon-cards summarizing top 4-6 insights
   - sub-category "Strategic Implications" with a comparison or matrix showing priorities
   - sub-category "Report Overview" with a brief roadmap of sections
   - Total: 12-20 blocks — this section sets the tone, make it comprehensive

2. EACH CONTENT SECTION must have 12-20 blocks following this structure:
   a. sub-category for first theme → paragraph (2-3 sentences) → metrics/scorecards → chart → key-finding
   b. separator → sub-category for second theme → icon-cards or comparison or matrix → paragraph → table or progress
   c. If the section has 3+ sub-topics: separator → sub-category for third theme → chart (different type) → paragraph → callout
   d. Closing: highlight-box with the #1 finding → source attribution
   Every sub-topic listed under a section MUST become a sub-category with its own blocks. Do NOT merge or skip sub-topics.

3. DO NOT include a "Research Process" or "Team Activity" section — the system adds that automatically.

4. VISUAL DIVERSITY RULES:
   - NEVER use more than 2 bar-v charts in the entire report — use line, donut, radar, area, stacked-bar, waterfall, scatter
   - Use at least 4 different chart types across the report
   - Every section needs at least 3 visual blocks (charts, metrics, icon-cards, scorecards, tables, comparison, matrix, progress — NOT counting paragraphs/headings)
   - Use icon-cards for recommendations, capabilities, pillars (4-6 cards each)
   - Use matrix for strategic positioning or prioritization decisions
   - Use scorecards for status/health dashboards with color-coded statuses
   - Use tables with 4+ rows of REAL data from the research

5. CONTENT IS TRUTH: ALL text, numbers, and data MUST come from the RESEARCH DATA provided above. The block examples in the schema are FORMAT demonstrations only. Every data point must be extracted from the actual research. Never fabricate statistics.

6. ANTI-LAZINESS — CRITICAL:
   - This report is for a PAYING CLIENT at an executive level. It must rival McKinsey / BCG / Strategy& quality.
   - Minimum 12 blocks per section. Sections with fewer than 10 blocks = REJECTION.
   - Every paragraph must be 3-5 sentences with specific data, not generic filler.
   - Charts must have 4+ data points from REAL research data.
   - Tables must have 4+ rows with real comparative data.
   - Icon-cards must have 4-6 items with specific, data-backed descriptions.
   - NEVER produce a section that is just paragraphs and lists. Every section needs rich visuals.

${getWorkLevelInstructions(settings?.workLevelReport, 'report')}

Output ONLY valid JSON — no markdown, no \`\`\`, no explanation.`;
}

// ═══════════════════════════════════════════════════════════════════════
// JSON-MODE generation — single-call
// ═══════════════════════════════════════════════════════════════════════

async function generateReportJSON({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO }) {
  const maxTokens = settings?.reportMaxTokens || 128000;
  const sections = plan?.sections || [];
  const reportModel = settings?.reportModel || '';
  const baseSettings = reportModel ? { ...settings, model: reportModel } : { ...settings };
  const modelSettings = baseSettings;
  const reportReasoning = settings?.reportReasoningEffort || 'medium';
  const reportTitle = understanding?.topic || plan?.mainMessage || 'Research Report';

  // Decide: single call vs parallel chunks
  const useSingleCall = settings?.reportSingleCall === true;

  if (useSingleCall) {
    // ── Single-call JSON mode ──
    console.log(`[Report/JSON] Single-call for ${sections.length} sections`);
    if (onProgress) onProgress('Generating structured report (JSON mode)...');
    const callStart = Date.now();

    try {
      const prompt = buildJSONSingleCallPrompt({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings });
      const callOpts = {
        systemPrompt: `You are a senior strategy consultant. TODAY: ${currentDateString()}. Output ONLY valid JSON — no markdown, no explanation.`,
        returnJSON: true,
        temperature: 0.5,
        maxTokens,
        reasoningEffort: reportReasoning,
        timeout: 1200000,
      };

      let result = await agentChat(prompt, modelSettings, callOpts);
      const duration = Date.now() - callStart;
      const rawResult = typeof result === 'string' ? result : JSON.stringify(result);

      // Parse JSON
      let reportJSON;
      if (typeof result === 'string') {
        result = result.trim();
        if (result.startsWith('```')) result = result.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
        reportJSON = JSON.parse(result);
      } else {
        reportJSON = result;
      }

      // Build tabs from JSON sections
      const jsonSections = reportJSON.sections || [];
      const tabs = jsonSections.map((s, i) => ({
        title: s.title || sections[i]?.sectionTitle || sections[i]?.title || `Section ${i + 1}`,
        shortTitle: (s.title || `Section ${i + 1}`).split(' ').slice(0, 4).join(' '),
        subtitle: s.subtitle || '',
        html: renderSectionFromJSON(s),
      }));

      // Generate rich appendix with per-worker AI calls (parallel)
      const appendixSections = await generateRichAppendixSections(knowledgeEntries, modelSettings, onProgress);

      const html = wrapInHTMLShell(reportTitle, plan?.mainMessage || '', tabs, teamActivities, appendixSections);
      const durationSec = Math.round(duration / 1000);

      if (onAiIO) onAiIO({ step: 'Generate report (JSON single-call)', input: prompt, output: rawResult, timestamp: new Date().toISOString(), duration, model: modelSettings.model || 'default', maxTokens, temperature: 0.5, reasoningEffort: reportReasoning });
      audit('report', 'JSON single-call', { model: modelSettings.model, sections: sections.length, duration, status: 'ok' });
      if (onProgress) onProgress(`Report ready (${durationSec}s)`);
      return { success: true, html, title: reportTitle };
    } catch (err) {
      const duration = Date.now() - callStart;
      console.error('[Report/JSON] Single-call failed:', err);
      if (onAiIO) onAiIO({ step: 'Generate report (JSON single-call - failed)', input: `${sections.length} sections`, output: `Error: ${err.message}`, timestamp: new Date().toISOString(), duration, model: modelSettings.model || 'default' });
      audit('report', 'JSON single-call FAILED', { model: modelSettings.model, sections: sections.length, duration, error: err.message });
      if (onProgress) onProgress(`Report failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ── Parallel chunk JSON mode ──
  const numChunks = sections.length <= 6 ? 2 : sections.length <= 12 ? 3 : 4;
  const sectionChunks = chunkArray(sections, numChunks);

  console.log(`[Report/JSON] Parallel: ${numChunks} chunks for ${sections.length} sections`);
  if (onProgress) onProgress(`Generating report (JSON mode): ${numChunks} parallel calls`);

  const callStart = Date.now();
  let completedChunks = 0;

  try {
    let currentIdx = 0;
    const chunkPrompts = sectionChunks.map(chunk => {
      const indices = chunk.map((_, i) => currentIdx + i);
      currentIdx += chunk.length;
      return { sections: chunk, indices };
    });

    const callOpts = {
      systemPrompt: 'You are a senior strategy consultant. Output ONLY valid JSON — no markdown, no explanation.',
      returnJSON: true,
      temperature: 0.5,
      maxTokens: settings?.reportMaxTokens || 128000,
      reasoningEffort: reportReasoning,
      timeout: 1200000,
    };

    const chunkResults = await Promise.all(
      chunkPrompts.map(async ({ sections: chunkSections, indices }, chunkIdx) => {
        const chunkStart = Date.now();
        const prompt = buildJSONChunkPrompt({ sections: chunkSections, sectionIndices: indices, knowledge, knowledgeEntries, understanding, plan, settings });
        const sectionRange = `${indices[0] + 1}-${indices[indices.length - 1] + 1}`;

        if (onProgress) onProgress(`Generating sections ${sectionRange} (JSON)...`);

        try {
          let result = await agentChat(prompt, modelSettings, callOpts);
          const rawResult = typeof result === 'string' ? result : JSON.stringify(result);
          const chunkDuration = Math.round((Date.now() - chunkStart) / 1000);
          completedChunks++;

          // Store full prompt + response for AI IO
          if (onAiIO) onAiIO({ step: `Generate report chunk ${chunkIdx + 1} (sections ${sectionRange})`, input: prompt, output: rawResult, timestamp: new Date().toISOString(), duration: Date.now() - chunkStart, model: modelSettings.model || 'default', maxTokens: callOpts.maxTokens, temperature: 0.5, reasoningEffort: reportReasoning });

          // Parse JSON
          let parsed;
          if (typeof result === 'string') {
            result = result.trim();
            if (result.startsWith('```')) result = result.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
            parsed = JSON.parse(result);
          } else {
            parsed = result;
          }

          if (onProgress) onProgress(`Completed ${completedChunks}/${numChunks} (${chunkDuration}s)`);
          return { data: parsed, indices, error: null };
        } catch (err) {
          console.error(`[Report/JSON] Chunk ${chunkIdx + 1} failed:`, err.message);
          if (onProgress) onProgress(`Chunk ${chunkIdx + 1} failed: ${err.message}`);
          return { data: null, indices, error: err.message };
        }
      })
    );

    const duration = Date.now() - callStart;
    const durationSec = Math.round(duration / 1000);
    const errors = chunkResults.filter(r => r.error);

    if (errors.length === numChunks) {
      const errorMsg = errors.map(e => e.error).join('; ');
      if (onProgress) onProgress(`Report failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Merge: extract sections from each chunk by key
    const sectionContents = new Map();
    for (const { data, indices } of chunkResults) {
      if (!data) continue;

      // Try section_N keys first
      for (const idx of indices) {
        const key = `section_${idx + 1}`;
        if (data[key]) {
          sectionContents.set(idx + 1, data[key]);
        }
      }

      // Fallback: if data has "sections" array
      if (data.sections && Array.isArray(data.sections)) {
        data.sections.forEach((s, si) => {
          if (si < indices.length) {
            sectionContents.set(indices[si] + 1, s);
          }
        });
      }

      // Last fallback: if it's a single section object with blocks
      if (indices.length === 1 && !sectionContents.has(indices[0] + 1) && (data.blocks || data.title)) {
        sectionContents.set(indices[0] + 1, data);
      }
    }

    // Build tabs
    const tabs = sections.map((s, i) => {
      const sectionData = sectionContents.get(i + 1);
      const fallbackTitle = s.sectionTitle || s.title || s.name || `Section ${i + 1}`;
      if (sectionData) {
        return {
          title: sectionData.title || fallbackTitle,
          shortTitle: (sectionData.title || fallbackTitle).split(' ').slice(0, 4).join(' '),
          subtitle: sectionData.subtitle || s.keyMessage || '',
          html: renderSectionFromJSON(sectionData),
        };
      }
      return {
        title: fallbackTitle,
        shortTitle: fallbackTitle.split(' ').slice(0, 4).join(' '),
        subtitle: s.keyMessage || '',
        html: `<p style="color:#999">Content not generated for this section.</p>`,
      };
    });

    // Generate rich appendix with per-worker AI calls (parallel)
    const appendixSections = await generateRichAppendixSections(knowledgeEntries, modelSettings, onProgress);

    const html = wrapInHTMLShell(reportTitle, plan?.mainMessage || '', tabs, teamActivities, appendixSections);

    if (onAiIO) onAiIO({ step: `Generate report (JSON ${numChunks} chunks)`, input: `${sections.length} sections`, output: `${html.length} chars HTML`, timestamp: new Date().toISOString(), duration, model: modelSettings.model || 'default', maxTokens: callOpts.maxTokens, temperature: 0.5, reasoningEffort: reportReasoning });
    audit('report', `JSON parallel (${numChunks} chunks)`, { model: modelSettings.model, sections: sections.length, chunks: numChunks, duration, errors: errors.length, status: 'ok' });

    if (errors.length > 0) {
      if (onProgress) onProgress(`Report ready (${durationSec}s) - ${errors.length} sections failed`);
    } else {
      if (onProgress) onProgress(`Report ready (${durationSec}s)`);
    }

    return { success: true, html, title: reportTitle };
  } catch (err) {
    const duration = Date.now() - callStart;
    console.error('[Report/JSON] Parallel generation failed:', err);
    if (onAiIO) onAiIO({ step: 'Generate report (JSON parallel - failed)', input: `${sections.length} sections`, output: `Error: ${err.message}`, timestamp: new Date().toISOString(), duration, model: modelSettings.model || 'default' });
    audit('report', 'JSON parallel FAILED', { model: modelSettings.model, error: err.message, duration });
    if (onProgress) onProgress(`Report failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Single-call report generation (simpler, more consistent styling) ───
async function generateReportSingleCall({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO }) {
  const maxTokens = settings?.reportMaxTokens || 128000;
  const sections = plan?.sections || [];

  const reportModel = settings?.reportModel || '';
  const baseSettings = reportModel
    ? { ...settings, model: reportModel }
    : { ...settings };

  const modelSettings = baseSettings;
  const reportReasoning = settings?.reportReasoningEffort || 'medium';

  const customSystemPrompt = settings?.reportSystemPrompt || '';
  const systemPrompt = customSystemPrompt || `You create beautiful, professional HTML reports. TODAY: ${currentDateString()}. Output complete, valid HTML.`;

  console.log(`[Report] Single-call generation for ${sections.length} sections`);
  if (onProgress) onProgress(`Generating complete HTML report...`);

  const callStartTime = Date.now();

  // Build the approved plan/flow structure for sidebar
  const sectionList = sections.map((s, i) => {
    const title = s.sectionTitle || s.title || s.name || `Section ${i + 1}`;
    const key = s.keyMessage || '';
    return `${i + 1}. ${title}${key ? ` — ${key}` : ''}`;
  }).join('\n');

  // Build team activities timeline — include full actions so the model knows what each member did
  const activitiesList = (teamActivities || []).map((a, i) => {
    const roleIcon = a.role === 'manager' ? '👔' : a.role === 'consultant' ? '📊' : '🔍';
    const specialty = a.specialty ? ` — ${a.specialty}` : '';
    const actions = (a.actions || []).map(act => {
      const verb = act.type || 'Action';
      const desc = act.description || '';
      const target = act.briefedTo ? ` → ${act.briefedTo}` : '';
      return `     - ${verb}: ${desc}${target}`;
    }).join('\n');
    return `${i + 1}. ${roleIcon} ${a.name} (${a.role || 'consultant'}${specialty})${actions ? '\n' + actions : ''}`;
  }).join('\n');

  const reportTitle = understanding?.topic || plan?.mainMessage || 'Research Report';
  const mainMessage = understanding?.governingThought || understanding?.topic || '';
  const audience = understanding?.audience || 'business professionals';
  const fullAsk = understanding?.fullClientAsk || understanding?.topic || '';
  const narrativeFlow = understanding?.narrativeFlow || plan?.storylineFlow || '';

  // Build the prompt with pyramid structure
  const prompt = `Create a complete HTML report page. Output ONLY the HTML code starting with <!DOCTYPE html>.
TODAY: ${currentDateString()}

REPORT TITLE: ${reportTitle}
TOPIC: ${fullAsk}
AUDIENCE: ${audience}
${mainMessage ? `GOVERNING THOUGHT (main conclusion): ${mainMessage}` : ''}
${narrativeFlow ? `NARRATIVE FLOW: ${narrativeFlow}` : ''}

════════════════════════════════════════════════════════════════
APPROVED REPORT STRUCTURE (this is the flow approved by the user):
════════════════════════════════════════════════════════════════
${sectionList}

This structure MUST appear in the left sidebar navigation. The sidebar should show the full outline/tree so users know exactly where they are.

════════════════════════════════════════════════════════════════
TEAM ACTIVITIES (what the research team did):
════════════════════════════════════════════════════════════════
${activitiesList || 'No activities recorded'}

Include a "How We Got Here" or "Research Process" section showing these steps visually (timeline, process diagram, or step cards).

════════════════════════════════════════════════════════════════
RESEARCH DATA TO USE:
${knowledge}

────────────────────────────────────────────────────────────────
DESIGN REQUIREMENTS:
────────────────────────────────────────────────────────────────

Create a CONSULTANT-STYLE STRATEGIC REPORT with premium dashboard aesthetics.

════════════════════════════════════════════════════════════════
PYRAMID STRUCTURE (McKinsey/BCG style):
════════════════════════════════════════════════════════════════

The report MUST follow this hierarchical flow:

1. EXECUTIVE SUMMARY (first section, always visible by default)
   - Hero banner with the GOVERNING THOUGHT (main conclusion)
   - 3-4 key stat cards summarizing the most important findings
   - Brief overview of what this report covers
   - This is the "answer first" — reader gets the conclusion immediately

2. SECTION SUMMARIES (one-liner for each section in the approved structure)
   - Show as a visual "roadmap" or card grid
   - Each card: section icon + title + one-sentence key message
   - Clicking navigates to that section

3. DETAILED SECTIONS (following the APPROVED REPORT STRUCTURE exactly)
   - Each section starts with its key insight (not buried at the end)
   - Supporting evidence: charts, data, tables
   - Analysis and implications
   - Use the section titles and order from the approved structure

4. RESEARCH PROCESS SECTION ("How We Got Here")
   - Visual timeline or process diagram of TEAM ACTIVITIES
   - Show the steps the team took: research, analysis, synthesis
   - Makes the work transparent and builds credibility

════════════════════════════════════════════════════════════════
LAYOUT — LEFT SIDEBAR + MAIN CONTENT:
════════════════════════════════════════════════════════════════

- Fixed left sidebar (220-260px) showing:
  • Report title at top
  • "Executive Summary" link
  • Collapsible tree of all sections from APPROVED STRUCTURE
  • "Research Process" link at bottom
  • Current section clearly highlighted (accent color background)

- Main content area (remaining width):
  • Full and spacious — NO squeezed multi-column grids
  • Single column flow with generous padding (40-60px sides)
  • Charts should be large and readable, not cramped

VISUAL STYLE:
- Light theme — clean, professional, consulting-grade
- Strategy& / McKinsey aesthetic — not dark/techy
- Smooth transitions, hover states
- Professional typography with clear hierarchy

COLOR SCHEME (light mode):
  --bg: #FFFFFF
  --surface: #F7F9FB
  --surface2: #EEF2F6
  --border: #E6E9EE
  --text: #1a1a2e
  --text-muted: #64748b
  --accent: #8E1E1E (Strategy& maroon)
  --accent-hover: #A32020
  --accent-soft: #F8E3E3
  --success: #059669
  --warning: #d97706
  --sidebar-bg: #FFFFFF
  --sidebar-border: #E6E9EE
  --sidebar-text: #374151
  --sidebar-text-muted: #6B7280

ICONS: Use Unicode symbols:
- Navigation: ▸ ▾ → ● ○ ◉
- Status: ✓ ✕ ⚡ ⚠️
- Content: 📊 📈 🎯 💡 📋 🔍 👔 🔬

COMPONENTS (use appropriately):
- Hero banner for executive summary
- Stat cards (big number + label + trend arrow, hover lift effect)
- Insight callout boxes (gradient bg, icon, hover glow)
- Full-width charts (Chart.js)
- Interactive tables (see TABLE INTERACTIVITY below)
- Quote blocks for key findings
- Timeline/process visualization for team activities
- Progress bars with animations, status badges

CONSULTING-STYLE FORMATTING:
- Within cards, ALWAYS use bullets (<ul>) or numbered lists for clarity
- For key points, use the .num-list class: <ul class="num-list"><li><span class="num-box">1</span><span class="num-text"><strong>Title:</strong> Description</span></li></ul>
- Never put dense paragraphs in cards — break into digestible bullet points
- Use bold (<strong>) for key terms within bullet text
- Give cards breathing room — don't cram too much content

EVERYTHING MUST BE INTERACTIVE:
- All cards: hover lift (transform: translateY(-2px)), subtle shadow increase
- All buttons: hover color change, scale(1.02)
- All clickable elements: cursor:pointer, transition: all 0.2s ease
- Smooth transitions on EVERYTHING (0.2s-0.3s ease)

TABLE INTERACTIVITY (make tables feel alive):
- Row hover: background color change, slight left border accent appears
- Sortable columns: click header to sort (add ▲▼ indicators)
- Alternating row colors (subtle)
- Cell hover: highlight the cell
- Clickable rows where relevant
- Smooth transitions on all hover states
- Optional: sticky header on scroll

Example table CSS:
  table { border-collapse: collapse; width: 100%; }
  th { cursor: pointer; user-select: none; }
  th:hover { background: var(--surface2); }
  tr { transition: all 0.2s ease; }
  tr:hover { background: var(--accent-soft); transform: scale(1.005); }
  tr:hover td:first-child { border-left: 3px solid var(--accent); }

CHARTS (Chart.js — MODERN SAAS DASHBOARD QUALITY):
- USE ChartJS datalabels plugin for numbers ON the bars/segments:
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"><\/script>
- Bar charts: show values on top of each bar
- Doughnut/Pie: show percentages on segments AND total in center
- Line charts: show data points with values on hover
- Use gradient fills (ctx.createLinearGradient)
- Rounded bar corners (borderRadius: 6)
- Smooth animations (animation: { duration: 1000, easing: 'easeOutQuart' })
- Rich tooltips with custom formatting
- Proper legends with click-to-hide functionality
- IMPORTANT: Use dark text colors for labels/legends (readable on white background)

Chart configuration example:
  plugins: {
    datalabels: {
      color: '#374151',
      anchor: 'end',
      align: 'top',
      font: { weight: 'bold', size: 11 },
      formatter: (value) => value.toLocaleString()
    },
    tooltip: {
      backgroundColor: 'rgba(0,0,0,0.8)',
      titleFont: { size: 14, weight: 'bold' },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 8
    }
  }

Chart colors (use these — matches Strategy& consulting palette):
  const chartColors = ['#8E1E1E', '#c41230', '#2563EB', '#059669', '#d97706', '#7c3aed', '#0891B2', '#ea580c'];

SCRIPTS:
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"><\/script>

────────────────────────────────────────────────────────────────
YOUR TASK:
────────────────────────────────────────────────────────────────
Create a polished, consultant-style HTML report:

TITLE: "${reportTitle}"
${mainMessage ? `MAIN CONCLUSION: "${mainMessage}"` : ''}
SECTIONS: Follow the APPROVED REPORT STRUCTURE exactly (${sections.length} sections)
ACTIVITIES: Include TEAM ACTIVITIES as a "Research Process" section

REQUIREMENTS:
1. Executive Summary FIRST with the main conclusion (pyramid principle)
2. Left sidebar showing the approved structure as a navigation tree
3. Each section from the approved structure, in order
4. "How We Got Here" section showing team activities visually
5. Light theme, professional consulting aesthetics (Strategy& / McKinsey style)

CRITICAL — CONTENT COMPLETENESS (NON-NEGOTIABLE):
- Use ALL data from the RESEARCH section — every insight, every number, every finding, every statistic
- Do NOT summarize or omit data. If the research has 20 data points, all 20 MUST appear with visual treatments
- Each section should be EXHAUSTIVELY RICH — multiple charts, tables, metrics cards, highlight boxes, and deep analysis
- The report should be VERY LONG and COMPREHENSIVE — depth over brevity, always
- Err on the side of MORE content, not less. This is a premium deliverable for a paying client
- Every section needs 2-3 sub-sections with their own visual elements and analysis
- Include ALL team member contributions — show what each researcher found and analyzed
- 1200+ words of content per section — thin sections will be rejected

${getWorkLevelInstructions(settings?.workLevelReport, 'report')}

Make it look like a premium McKinsey/BCG/Strategy& consulting deliverable. Clear hierarchy, insights first, visual clarity, data-rich.

Output ONLY the complete HTML starting with <!DOCTYPE html>.`;

  try {
    const callOpts = {
      systemPrompt,
      returnJSON: false,
      temperature: 0.6,
      maxTokens,
      reasoningEffort: reportReasoning,
      timeout: 1200000, // 20 minutes
    };

    let html = await agentChat(prompt, modelSettings, callOpts);

    // Clean markdown fences
    if (typeof html === 'string') {
      html = html.trim();
      if (html.startsWith('```html')) html = html.slice(7);
      else if (html.startsWith('```')) html = html.slice(3);
      if (html.endsWith('```')) html = html.slice(0, -3);
      html = html.trim();
    }

    const duration = Date.now() - callStartTime;
    const durationSec = Math.round(duration / 1000);
    console.log(`[Report] Single-call completed in ${durationSec}s (${html?.length || 0} chars)`);

    if (onAiIO) {
      onAiIO({
        step: 'Generate report (single call)',
        input: prompt,
        output: html || '',
        timestamp: new Date().toISOString(),
        duration,
        model: modelSettings.model || 'default',
        maxTokens,
        temperature: 0.6,
        searchEnabled: !!modelSettings.searchEnabled,
        reasoningEffort: reportReasoning,
      });
    }

    audit('report', 'single-call generation', {
      model: modelSettings.model,
      sections: sections.length,
      duration,
      status: 'ok',
    });

    if (onProgress) onProgress(`Report ready (${durationSec}s)`);
    return { success: true, html, title: reportTitle };

  } catch (err) {
    const duration = Date.now() - callStartTime;
    const durationSec = Math.round(duration / 1000);

    if (onAiIO) {
      onAiIO({
        step: 'Generate report (single call - failed)',
        input: `${sections.length} sections`,
        output: `Error: ${err.message}`,
        timestamp: new Date().toISOString(),
        duration,
        model: modelSettings.model || 'default',
        maxTokens,
        temperature: 0.6,
        searchEnabled: !!modelSettings.searchEnabled,
        reasoningEffort: reportReasoning,
      });
    }

    audit('report', 'single-call FAILED', {
      model: modelSettings.model,
      sections: sections.length,
      duration,
      status: 'error',
      error: err.message,
    });

    console.error('[reportService] Single-call generation failed:', err);
    if (onProgress) onProgress(`Report failed after ${durationSec}s: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Main export ───
export async function generateReport({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO }) {
  const fmt = settings?.reportFormat || 'json';
  const singleCall = settings?.reportSingleCall === true;
  console.log(`[Report] Routing: reportFormat=${fmt}, reportSingleCall=${singleCall}`);

  // Route to single-call HTML if explicitly enabled (model generates entire page)
  if (singleCall) {
    if (onProgress) onProgress('Generating report (one-shot HTML mode)...');
    return generateReportSingleCall({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO });
  }

  // Route to raw HTML parallel chunks only if explicitly set to 'html'
  if (fmt === 'html') {
    if (onProgress) onProgress('Generating report (multi-agent HTML mode)...');
    return generateReportParallelHTML({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO });
  }

  // Default: JSON mode — most coherent visual output.
  // LLM outputs structured JSON blocks, rendered deterministically by renderSectionFromJSON.
  // All sections get identical CSS treatment, charts/tables/callouts render consistently.
  if (onProgress) onProgress('Generating report (JSON structured mode)...');
  return generateReportJSON({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO });
}

// ─── Parallel HTML chunk mode (opt-in via reportFormat='html') ───
// Model generates raw HTML per chunk with creative freedom. Coherence ensured by:
// 1. Identical comprehensive design system prompt for every chunk
// 2. Post-processing strips rogue inline styles
// 3. wrapInHTMLShell provides all CSS
async function generateReportParallelHTML({ plan, knowledge, knowledgeEntries, understanding, teamActivities, settings, onProgress, onAiIO }) {
  const maxTokens = settings?.reportMaxTokens || 128000;
  const sections = plan?.sections || [];
  const reportModel = settings?.reportModel || '';
  const baseSettings = reportModel ? { ...settings, model: reportModel } : { ...settings };
  const modelSettings = baseSettings;
  const reportReasoning = settings?.reportReasoningEffort || 'medium';
  const compiledNarrative = plan?.compiledNarrative || '';

  const numChunks = sections.length <= 6 ? 2 : sections.length <= 12 ? 3 : 4;
  const sectionChunks = chunkArray(sections, numChunks);

  console.log(`[Report/HTML] Parallel: ${numChunks} chunks for ${sections.length} sections`);
  if (onProgress) onProgress(`Generating report (HTML mode): ${numChunks} parallel calls`);

  // ── Comprehensive design system prompt — identical for ALL chunks ──
  const designSystem = `You are a senior analyst writing premium consulting report sections.
TODAY: ${currentDateString()}
Your output is HTML snippets that will be inserted into a pre-built shell with a complete CSS design system.

═══ ABSOLUTE RULES ═══
1. NEVER use inline styles (style="..."). All styling comes from CSS classes in the shell.
2. NEVER add <style> tags, <link> tags, or CSS. The shell handles ALL styling.
3. Use ONLY the CSS classes listed below. Do not invent new classes.
4. Output one <div data-section="N"> wrapper per section, where N matches the section number.

═══ CSS CLASSES AVAILABLE (use these and ONLY these) ═══

TEXT: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>
     .section-content a — links get accent color automatically

KEY FINDING:
  <div class="key-finding"><div class="kf-label">Key Finding</div><p>Insight text</p></div>

CALLOUTS (blue/green/amber/teal):
  <div class="callout blue"><div class="callout-label">Note</div><p>Detail</p></div>
  <div class="callout green"><div class="callout-label">Success</div><p>Detail</p></div>
  <div class="callout amber"><div class="callout-label">Warning</div><p>Detail</p></div>

METRIC CARDS:
  <div class="metric-row">
    <div class="metric-card"><div class="mc-value">$4.2B</div><div class="mc-label">Revenue</div><div class="mc-delta up">+23%</div></div>
  </div>

DATA TABLE:
  <table class="data-table"><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Value</td><td class="num">123</td></tr></tbody></table>

CHARTS (auto-rendered by Chart.js):
  <div class="auto-chart" data-chart='{"type":"bar-v","title":"Title","data":[{"label":"A","value":45}]}'></div>
  Types: bar-v, bar-h, line, donut, pie, radar, area, stacked-bar, waterfall, gauge, funnel

CARDS:
  <div class="card bordered-top"><div class="card-title">Title</div><div class="card-text">Content</div></div>

COMPARE CARDS:
  <div class="compare-row"><div class="compare-card"><h5>Option A</h5><p>Description</p></div></div>

GRIDS & LAYOUTS:
  .grid-2, .grid-3, .grid-4 — equal column grids
  .grid-2-1, .grid-1-2, .grid-3-2, .grid-2-3 — ratio grids
  .flex-row — flexible row (children flex:1)
  .metric-row — auto-fit metric cards
  .compare-row — auto-fit comparison cards
  .icon-cards — auto-fit icon cards
  .scorecard-row — auto-fit scorecards
  .stack — vertical stack with gap

ICON CARDS (accent-blue/green/amber/red/violet/teal):
  <div class="icon-cards">
    <div class="icon-card accent-blue"><div class="ic-icon">📊</div><div class="ic-body"><div class="ic-title">Title</div><div class="ic-text">Text</div></div></div>
  </div>

TIMELINE:
  <div class="timeline"><div class="timeline-item"><div class="tl-date">Q1 2025</div><div class="tl-title">Milestone</div><div class="tl-desc">Description</div></div></div>

PROGRESS BARS:
  <div class="progress-group"><div class="progress-item"><div class="prog-header"><span class="prog-label">Category</span><span class="prog-value">75%</span></div><div class="prog-track"><div class="prog-fill" style="width:75%"></div></div></div></div>

TAGS: <span class="tag green">Positive</span> <span class="tag red">Risk</span> <span class="tag blue">Info</span>

HIGHLIGHT BOX (use sparingly — 1 per section max):
  <div class="highlight-box"><div class="hb-label">KEY INSIGHT</div><div class="hb-value">$12M</div><div class="hb-text">Explanation</div></div>

CHEVRON FLOW:
  <div class="chevron-flow"><div class="chevron active"><div class="chev-num">01</div><div class="chev-title">Step</div><div class="chev-desc">Description</div></div></div>

SUB-CATEGORY DIVIDER:
  <div class="sub-category"><div class="sc-label">PART A</div><div class="sc-title">Sub-section Title</div><div class="sc-desc">Brief description</div></div>

MATRIX 2×2:
  <div class="matrix-grid"><div class="matrix-cell"><div class="mx-quadrant">HIGH/HIGH</div><div class="mx-title">Stars</div><div class="mx-desc">Description</div></div></div>

VISUAL SEPARATORS:
  <div class="section-divider"></div>
  <div class="h-divider"></div>

SOURCE NOTES: <div class="source-note">Source: Company Annual Report 2024</div>

═══ QUALITY RULES — NON-NEGOTIABLE ═══
- Every section needs 3+ visual elements (charts, tables, metrics, cards, scorecards, highlight-boxes, etc.)
- VARY visual elements — don't repeat the same pattern in consecutive sections
- Use REAL data from the research — every number, every statistic, every finding must appear
- Structure: sub-category → context paragraph → data viz → insight → deeper analysis → more data viz → implications
- Be EXHAUSTIVELY THOROUGH — 1200+ words per section with deep, real analysis
- Each section MUST have 2-3 sub-categories to create visual rhythm and break up content
- Include ALL research findings — if a consultant found 10 data points, all 10 must appear with context
- Do NOT summarize or abbreviate research data — present it in full with analysis
- This is a premium consulting deliverable for a paying client — thin sections are UNACCEPTABLE

═══ ANTI-LAZINESS RULES ═══
- Every section MUST have at least 3 different visual element types (chart + table + metrics, cards + chart + highlight-box, etc.)
- DO NOT just produce heading → paragraph → paragraph → list. That is BORING and will be rejected.
- VARY chart types across sections (bar, line, doughnut, radar, etc.)
- Use ALL the consultant research data — every data point earns a visual treatment
- Think McKinsey / BCG / Strategy& quality — insight-first, data-rich, visually compelling`;

  const callStartTime = Date.now();
  let completedChunks = 0;

  try {
    let currentIdx = 0;
    const chunkPrompts = sectionChunks.map(chunk => {
      const indices = chunk.map((_, i) => currentIdx + i);
      currentIdx += chunk.length;
      return { sections: chunk, indices };
    });

    const callOpts = {
      systemPrompt: designSystem,
      returnJSON: false,
      temperature: 0.5,
      maxTokens,
      reasoningEffort: reportReasoning,
      timeout: 1200000,
    };

    const chunkResults = await Promise.all(
      chunkPrompts.map(async ({ sections: chunkSections, indices }, chunkIdx) => {
        const chunkStart = Date.now();

        // Build per-section blocks with matched research
        const sectionBlocks = chunkSections.map((s, i) => {
          const globalIdx = indices[i];
          const title = s.sectionTitle || s.title || s.name || `Section ${globalIdx + 1}`;
          const keyMsg = s.keyMessage || '';
          const slides = (s.slides || []).map(sl => `    • ${sl.title || ''}${sl.keyMessage ? ` — ${sl.keyMessage}` : ''}`).join('\n');

          const matched = matchResearchToSection(title, keyMsg, slides, knowledgeEntries);
          let block = `═══ SECTION ${globalIdx + 1}: "${title}" ═══${keyMsg ? `\nKey message: ${keyMsg}` : ''}${slides ? '\nSub-topics:\n' + slides : ''}`;
          if (matched.length > 0) {
            block += '\n── CONSULTANT RESEARCH ──';
            for (const m of matched) {
              block += `\n\n### ${m.source}\n${m.data}`;
            }
          }
          return block;
        }).join('\n\n');

        const prompt = `Generate RICH, COMPREHENSIVE HTML content for these report sections. Output ONLY HTML wrapped in <div data-section="N"> tags.

CRITICAL CONTENT RULE: Use ALL the consultant research data provided — every data point, every statistic, every finding, every number MUST appear in the output. Do NOT summarize or skip any research. If a section has 15 data points, all 15 must be presented with visual treatments and analysis. This is a premium consulting deliverable — DEPTH and RICHNESS are non-negotiable.

TOPIC: ${understanding?.fullClientAsk || understanding?.topic || ''}
AUDIENCE: ${understanding?.audience || 'business professionals'}
${understanding?.governingThought ? `GOVERNING THOUGHT: ${understanding.governingThought}` : ''}
${compiledNarrative ? `\n═══ EXECUTIVE NARRATIVE (Manager's synthesis) ═══\n${compiledNarrative}\n` : ''}

${sectionBlocks}

Each section MUST be wrapped: <div data-section="N">...content...</div>
Use the CSS classes from the design system. NO inline styles. NO <style> tags.

STRUCTURE PER SECTION:
- 2-3 sub-category dividers breaking the section into themed parts
- Opening context paragraph, then visual data (chart + metrics), then key insight
- Second sub-category with more visual evidence (cards, tables, comparisons)
- Third sub-category with implications, recommendations, or deeper analysis
- 1200+ words per section with real analysis — NOT summaries

${getWorkLevelInstructions(settings?.workLevelReport, 'report')}`;

        const sectionRange = `${indices[0] + 1}-${indices[indices.length - 1] + 1}`;
        console.log(`[Report/HTML] Chunk ${chunkIdx + 1}/${numChunks} starting (sections ${sectionRange})`);
        if (onProgress) onProgress(`Generating sections ${sectionRange}...`);

        try {
          let result = await agentChat(prompt, modelSettings, callOpts);

          if (typeof result === 'string') {
            result = result.trim();
            if (result.startsWith('```html')) result = result.slice(7);
            else if (result.startsWith('```')) result = result.slice(3);
            if (result.endsWith('```')) result = result.slice(0, -3);
            result = result.trim();
            // Post-process: strip inline styles (except width on progress fills)
            result = result.replace(/\sstyle="(?!width)[^"]*"/gi, '');
          }

          completedChunks++;
          const chunkDuration = Math.round((Date.now() - chunkStart) / 1000);
          console.log(`[Report/HTML] Chunk ${chunkIdx + 1} completed in ${chunkDuration}s (${result?.length || 0} chars)`);
          if (onProgress) onProgress(`Completed ${completedChunks}/${numChunks} chunks (${chunkDuration}s)`);

          // Store full prompt + response
          if (onAiIO) onAiIO({ step: `Generate report HTML chunk ${chunkIdx + 1} (sections ${sectionRange})`, input: prompt, output: result || '', timestamp: new Date().toISOString(), duration: Date.now() - chunkStart, model: modelSettings.model || 'default', maxTokens, temperature: 0.5, reasoningEffort: reportReasoning });

          return { html: result, indices, error: null };
        } catch (err) {
          console.error(`[Report/HTML] Chunk ${chunkIdx + 1} failed:`, err.message);
          if (onProgress) onProgress(`Chunk ${chunkIdx + 1} failed: ${err.message}`);
          return { html: null, indices, error: err.message };
        }
      })
    );

    const duration = Date.now() - callStartTime;
    const durationSec = Math.round(duration / 1000);
    const errors = chunkResults.filter(r => r.error);

    if (errors.length === numChunks) {
      const errorMsg = errors.map(e => e.error).join('; ');
      if (onProgress) onProgress(`Report failed after ${durationSec}s: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Extract section content from each chunk result
    const sectionContents = new Map();
    for (const { html, indices } of chunkResults) {
      if (!html) continue;

      const sectionRegex = /<div[^>]*data-section="(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*data-section="\d+"|$)/gi;
      let match;
      let foundSections = 0;
      while ((match = sectionRegex.exec(html)) !== null) {
        const sectionNum = parseInt(match[1], 10);
        let content = match[2].trim();
        if (content.endsWith('</div>')) {
          const openCount = (content.match(/<div/gi) || []).length;
          const closeCount = (content.match(/<\/div>/gi) || []).length;
          if (closeCount > openCount) {
            content = content.replace(/<\/div>\s*$/, '').trim();
          }
        }
        sectionContents.set(sectionNum, content);
        foundSections++;
      }

      if (foundSections === 0 && indices.length === 1) {
        sectionContents.set(indices[0] + 1, html);
      } else if (foundSections === 0 && indices.length > 1) {
        const parts = html.split(/(?=<h[23][^>]*>)/i).filter(p => p.trim());
        parts.forEach((part, pi) => {
          if (pi < indices.length) {
            sectionContents.set(indices[pi] + 1, part.trim());
          }
        });
        if (parts.length === 0) {
          sectionContents.set(indices[0] + 1, html);
        }
      }
    }

    // Build tabs
    const tabs = sections.map((s, i) => ({
      title: s.sectionTitle || s.title || s.name || `Section ${i + 1}`,
      shortTitle: (s.sectionTitle || s.title || s.name || `Section ${i + 1}`).split(' ').slice(0, 3).join(' '),
      subtitle: s.keyMessage || '',
      html: sectionContents.get(i + 1) || `<p style="color:#999">Content for section ${i + 1} not generated</p>`,
    }));

    const title = understanding?.topic || plan?.mainMessage || 'Research Report';
    const subtitle = plan?.mainMessage || understanding?.governingThought || '';

    // Generate rich appendix with per-worker AI calls (parallel)
    const appendixSections = await generateRichAppendixSections(knowledgeEntries, modelSettings, onProgress);

    const html = wrapInHTMLShell(title, subtitle, tabs, teamActivities, appendixSections);

    if (onAiIO) onAiIO({ step: `Generate report (HTML ${numChunks} chunks)`, input: `${sections.length} sections`, output: `${html.length} chars HTML`, timestamp: new Date().toISOString(), duration, model: modelSettings.model || 'default', maxTokens, temperature: 0.5, reasoningEffort: reportReasoning });
    audit('report', `HTML parallel (${numChunks} chunks)`, { model: modelSettings.model, chunks: numChunks, sections: sections.length, duration, errors: errors.length, status: 'ok' });

    if (errors.length > 0) {
      if (onProgress) onProgress(`Report ready (${durationSec}s) - ${errors.length} sections failed`);
    } else {
      if (onProgress) onProgress(`Report ready (${durationSec}s)`);
    }

    return { success: true, html, title };
  } catch (err) {
    const duration = Date.now() - callStartTime;
    const durationSec = Math.round(duration / 1000);
    if (onAiIO) onAiIO({ step: 'Generate report (HTML - failed)', input: `${sections.length} sections`, output: `Error: ${err.message}`, timestamp: new Date().toISOString(), duration, model: modelSettings.model || 'default' });
    audit('report', 'HTML parallel FAILED', { model: modelSettings.model, duration, error: err.message, status: 'error' });
    console.error('[Report/HTML] Parallel generation failed:', err);
    if (onProgress) onProgress(`Report failed after ${durationSec}s: ${err.message}`);
    return { success: false, error: err.message };
  }
}
