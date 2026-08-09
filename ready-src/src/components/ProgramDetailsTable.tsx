import EditableText from './EditableText';
import { analytics } from '../services/analytics';

interface ProgramDetail {
  feature: string;
  description: string;
  essentials: string;
  core: string;
  max: string;
}

interface ProgramDetailsTableProps {
  details: ProgramDetail[];
  previewMode: boolean;
  onUpdate: (index: number, field: keyof ProgramDetail, value: string) => void;
  discoveryCallUrl?: string;
  onCtaClick?: () => void;
}

const renderStatusIndicator = (status: string) => {
  if (status === 'included') {
    return (
      <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
    );
  }
  if (status === 'enhanced') {
    return (
      <span style={{display:'inline-flex', gap:'6px', alignItems:'center', justifyContent:'center'}}>
        <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
        <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
      </span>
    );
  }
  if (status === 'premium') {
    return (
      <span style={{display:'inline-flex', gap:'6px', alignItems:'center', justifyContent:'center'}}>
        <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
        <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
        <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
      </span>
    );
  }
  if (status === 'not-included') {
    return (
      <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'transparent', boxShadow:'0 0 0 1.5px #94a3b8 inset'}}></span>
    );
  }
  // Default: treat as custom text
  return <span>{status}</span>;
};

export default function ProgramDetailsTable({ details, previewMode, onUpdate, discoveryCallUrl, onCtaClick }: ProgramDetailsTableProps) {
  return (
    <table
      role="table"
      aria-label="JSP Program Tiers Comparison"
      style={{
        width:'100%',
        borderCollapse:'separate',
        borderSpacing:'0',
        font:'16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
        color:'#0f172a',
        background:'#f8fafc'
      }}
    >
      <thead>
        <tr style={{background:'#e6f0f9', color:'#0a3b65'}}>
          <th style={{padding:'14px 12px', textAlign:'left', fontWeight:'700', borderBottom:'2px solid #d1e3f5'}}>Feature</th>
          <th style={{padding:'14px 12px', textAlign:'center', fontWeight:'700', borderBottom:'2px solid #d1e3f5'}}>Essentials</th>
          <th style={{padding:'14px 12px', textAlign:'center', fontWeight:'700', borderBottom:'2px solid #d1e3f5'}}>Core</th>
          <th style={{padding:'14px 12px', textAlign:'center', fontWeight:'700', borderBottom:'2px solid #d1e3f5'}}>Max</th>
        </tr>
      </thead>
      <tbody>
        {details.map((row, index) => (
          <tr key={index} style={{background: index % 2 === 0 ? '#ffffff' : '#f3f6fb'}}>
            <td style={{padding:'14px 12px', fontWeight:'600', borderBottom:'1px solid #dbe5f2'}}>
              <EditableText
                value={row.feature}
                onChange={(value) => onUpdate(index, 'feature', value)}
                previewMode={previewMode}
                className="font-semibold"
              />
              {row.description && (
                <span style={{display:'block', fontWeight:'500', color:'#475569', fontSize:'12px', marginTop:'2px'}}>
                  <EditableText
                    value={row.description}
                    onChange={(value) => onUpdate(index, 'description', value)}
                    previewMode={previewMode}
                    className="text-xs text-gray-600"
                  />
                </span>
              )}
            </td>
            <td style={{padding:'14px 12px', textAlign:'center', borderBottom:'1px solid #dbe5f2'}}>
              {['included', 'enhanced', 'premium', 'not-included'].includes(row.essentials) ? (
                renderStatusIndicator(row.essentials)
              ) : (
                <EditableText
                  value={row.essentials}
                  onChange={(value) => onUpdate(index, 'essentials', value)}
                  previewMode={previewMode}
                  className="text-sm"
                />
              )}
            </td>
            <td style={{padding:'14px 12px', textAlign:'center', borderBottom:'1px solid #dbe5f2'}}>
              {['included', 'enhanced', 'premium', 'not-included'].includes(row.core) ? (
                renderStatusIndicator(row.core)
              ) : (
                <EditableText
                  value={row.core}
                  onChange={(value) => onUpdate(index, 'core', value)}
                  previewMode={previewMode}
                  className="text-sm"
                />
              )}
            </td>
            <td style={{padding:'14px 12px', textAlign:'center', borderBottom:'1px solid #dbe5f2'}}>
              {['included', 'enhanced', 'premium', 'not-included'].includes(row.max) ? (
                renderStatusIndicator(row.max)
              ) : (
                <EditableText
                  value={row.max}
                  onChange={(value) => onUpdate(index, 'max', value)}
                  previewMode={previewMode}
                  className="text-sm"
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} style={{padding:'12px', background:'#ffffff', borderTop:'2px solid #d1e3f5', color:'#475569', fontSize:'14px'}}>
            <strong>Legend:</strong>
            <span style={{display:'inline-flex', alignItems:'center', gap:'8px', marginLeft:'12px', marginRight:'16px'}}>
              <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span> Included
            </span>
            <span style={{display:'inline-flex', alignItems:'center', gap:'8px', marginRight:'16px'}}>
              <span>
                <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
                <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc', marginLeft:'6px'}}></span>
              </span> Enhanced
            </span>
            <span style={{display:'inline-flex', alignItems:'center', gap:'8px', marginRight:'16px'}}>
              <span>
                <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc'}}></span>
                <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc', marginLeft:'6px'}}></span>
                <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'#0f7bdc', marginLeft:'6px'}}></span>
              </span> Premium
            </span>
            <span style={{display:'inline-flex', alignItems:'center', gap:'8px'}}>
              <span style={{display:'inline-block', width:'12px', height:'12px', borderRadius:'50%', background:'transparent', boxShadow:'0 0 0 1.5px #94a3b8 inset'}}></span> Not included
            </span>
          </td>
        </tr>
        {discoveryCallUrl && (
          <tr>
            <td colSpan={4} style={{padding:'20px 12px', background:'#f8fafc', borderTop:'1px solid #e2e8f0'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'12px', flexWrap:'wrap'}}>
                <p style={{margin:'0', color:'#334155', fontSize:'13px', lineHeight:'1.4', maxWidth:'350px'}}>
                  Book a 1:1 call to learn about the program components in more details and to learn about customization options
                </p>
                <a
                  href={discoveryCallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    analytics.trackInteraction('cta_click', 'program-table-book-now', 'Meeting CTA clicked in program table', null, {
                      button_type: 'program_table_meeting',
                      location: 'program_details_table'
                    });
                    onCtaClick?.();
                  }}
                  style={{
                    display:'inline-block',
                    padding:'10px 24px',
                    background:'#0f7bdc',
                    color:'#ffffff',
                    fontSize:'15px',
                    fontWeight:'600',
                    borderRadius:'6px',
                    textDecoration:'none',
                    transition:'background 0.2s ease',
                    whiteSpace:'nowrap'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0d69c0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#0f7bdc'}
                >
                  Book Now
                </a>
              </div>
            </td>
          </tr>
        )}
      </tfoot>
    </table>
  );
}
