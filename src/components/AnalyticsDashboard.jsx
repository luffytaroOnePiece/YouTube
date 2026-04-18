import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts';

function AnalyticsDashboard({ onClose, allVideos, isMonitorSize }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const stats = useMemo(() => {
    let totalWatchSec = 0;
    const groupWatchTime = {};
    let latestVideo = null;
    let highResCount = 0;

    const groupsCount = {};
    const resCount = {};
    const typeCount = {};
    const categoryCount = {};
    const yearCount = {};

    allVideos.forEach(v => {
      const sec = v.durationSec || 0;
      totalWatchSec += sec;

      if (v.group) {
        groupsCount[v.group] = (groupsCount[v.group] || 0) + 1;
        groupWatchTime[v.group] = (groupWatchTime[v.group] || 0) + sec;
      }
      
      if (v.resolution) {
        resCount[v.resolution] = (resCount[v.resolution] || 0) + 1;
        if (v.resolution === '4K' || v.resolution === '8K') {
            highResCount++;
        }
      }

      if (v.type) typeCount[v.type] = (typeCount[v.type] || 0) + 1;
      
      if (v.category) {
        categoryCount[v.category] = (categoryCount[v.category] || 0) + 1;
      }

      if (v.date) {
        const d = new Date(v.date);
        if (!isNaN(d.valueOf())) {
          const yearKey = `${d.getFullYear()}`;
          yearCount[yearKey] = (yearCount[yearKey] || 0) + 1;
          
          if (!latestVideo || d > new Date(latestVideo.date)) {
            latestVideo = v;
          }
        }
      }
    });

    const hours = Math.floor(totalWatchSec / 3600);
    const mins = Math.floor((totalWatchSec % 3600) / 60);

    const avgSec = allVideos.length ? Math.floor(totalWatchSec / allVideos.length) : 0;
    const avgMins = Math.floor(avgSec / 60);
    const avgRemainderSec = avgSec % 60;
    const avgDurationStr = `${avgMins}m ${avgRemainderSec}s`;

    const resData = Object.entries(resCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const groupTimePieData = Object.entries(groupWatchTime).map(([name, val]) => ({ name, value: Math.floor(val/3600) })).sort((a,b)=>b.value-a.value);
    const topTypes = Object.entries(typeCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    const catData = Object.entries(categoryCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const timelineData = Object.entries(yearCount).map(([name, count]) => ({ name, count, raw: name })).sort((a, b) => a.raw.localeCompare(b.raw));

    // New replaced KPI metrics
    const premiumPct = allVideos.length ? Math.round((highResCount / allVideos.length) * 100) : 0;
    const topMotifName = topTypes.length > 0 ? topTypes[0].name : 'N/A';
    const topMotifCount = topTypes.length > 0 ? topTypes[0].count : 0;
    const latestVideoStr = latestVideo ? latestVideo.title : 'N/A';
    const latestVideoDate = latestVideo ? new Date(latestVideo.date).toLocaleDateString() : '';

    return {
      totalVideos: allVideos.length,
      watchHours: hours,
      watchMins: mins,
      avgDurationStr,
      premiumPct,
      topMotifName,
      topMotifCount,
      latestVideoStr,
      latestVideoDate,
      resData,
      groupTimePieData,
      topTypes,
      catData,
      timelineData
    };
  }, [allVideos]);

  const topRecentVideos = useMemo(() => {
    return [...allVideos].filter(v => v.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  }, [allVideos]);

  const PIE_COLORS = ['#ff2d55', '#5856d6', '#ff9500', '#34c759', '#32ade6'];
  const RES_COLORS = { '8K': '#ff9500', '4K': '#007aff', '1080p': '#8e8e93' };
  const getResColor = (res) => RES_COLORS[res] || '#636366';

  const renderPieLabel = (props) => {
    const { name, percent } = props;
    if (typeof percent !== 'number' || percent < 0.03) return null;
    // Non-breaking spaces create a physical SVG bounding-box gap between the line and visible text!
    return `\u00A0\u00A0${name} ${(percent * 100).toFixed(0)}%\u00A0\u00A0`;
  };

  return (
    <div className="analytics-overlay" style={{ zoom: isMonitorSize ? (1 / 1.75) : 1 }}>
      <div className={`analytics-modal ${isMounted ? 'loaded' : ''}`}>
        
        <div className="analytics-modal__header">
          <div>
            <h2 className="analytics-modal__title">Library Insights</h2>
            <p className="analytics-modal__subtitle">Analyzing {allVideos.length} videos</p>
          </div>
          <button className="analytics-modal__close" onClick={onClose} title="Close Analytics">
            ✕
          </button>
        </div>

        <div className="analytics-modal__body">
          
          {/* Apple KPI Cards */}
          <div className="analytics-cards">
            <div className="apple-card">
              <span className="analytics-card__label">Total Watch Time</span>
              <span className="analytics-card__val">{stats.watchHours}<span style={{fontSize: '1.2rem'}}>h</span> {stats.watchMins}<span style={{fontSize: '1.2rem'}}>m</span></span>
              <span className="analytics-card__subval">Avg duration: {stats.avgDurationStr}</span>
            </div>
            <div className="apple-card">
              <span className="analytics-card__label">4K+ Ready (Premium)</span>
              <span className="analytics-card__val">{stats.premiumPct}%</span>
              <span className="analytics-card__subval">Videos in 8K or 4K</span>
            </div>
            <div className="apple-card">
              <span className="analytics-card__label">Top Content Flavor</span>
              <span className="analytics-card__val">{stats.topMotifName}</span>
              <span className="analytics-card__subval">{stats.topMotifCount} Items mapped</span>
            </div>
            <div className="apple-card">
              <span className="analytics-card__label">Most Recent Addition</span>
              <span className="analytics-card__val" style={{fontSize: '1.4rem', lineHeight: '1.2', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                {stats.latestVideoStr}
              </span>
              <span className="analytics-card__subval">Added on {stats.latestVideoDate}</span>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="analytics-charts">
            <div className="apple-chart-box">
              <h3 className="analytics-chart-title">Additions Over Time</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={stats.timelineData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007aff" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fontSize: 12, fill: 'rgba(255,255,255,0.8)'}} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{fontSize: 12, fill: 'rgba(255,255,255,0.8)'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)'}} itemStyle={{color: '#fff'}} />
                  <Area type="monotone" dataKey="count" stroke="#007aff" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="apple-chart-box">
              <h3 className="analytics-chart-title">Top 5 Content Types</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.topTypes}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fontSize: 12, fill: 'rgba(255,255,255,0.8)'}} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{fontSize: 12, fill: 'rgba(255,255,255,0.8)'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)'}} itemStyle={{color: '#fff'}} />
                  <Bar dataKey="count" fill="#ff2d55" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="apple-chart-box">
              <h3 className="analytics-chart-title">Watch Time by Group (Hours)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie 
                    data={stats.groupTimePieData} 
                    dataKey="value" nameKey="name" 
                    cx="50%" cy="50%" innerRadius={55} outerRadius={75} 
                    fill="#8884d8" paddingAngle={4} stroke="none"
                    label={renderPieLabel}
                    labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1.5 }}
                  >
                    {stats.groupTimePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)'}} itemStyle={{color: '#fff'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="apple-chart-box">
              <h3 className="analytics-chart-title">Resolution Breakdown</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie 
                    data={stats.resData} 
                    dataKey="value" nameKey="name" 
                    cx="50%" cy="50%" innerRadius={55} outerRadius={75} 
                    fill="#8884d8" paddingAngle={4} stroke="none"
                    label={renderPieLabel}
                    labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1.5 }}
                  >
                    {stats.resData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[(index+2) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)'}} itemStyle={{color: '#fff'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="apple-chart-box" style={{ gridColumn: '1 / -1' }}>
              <h3 className="analytics-chart-title">Category Scale (Language)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.catData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" tick={{fontSize: 12, fill: 'rgba(255,255,255,0.8)'}} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" tick={{fontSize: 12, fill: 'rgba(255,255,255,0.8)'}} width={100} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)'}} itemStyle={{color: '#fff'}} />
                  <Bar dataKey="count" fill="#32ade6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Videos Table */}
          <div className="apple-table-section">
            <h3 className="analytics-section-title">Recently Added</h3>
            <div className="analytics-table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Thumbnail</th>
                    <th>Title</th>
                    <th>Group</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Resolution</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecentVideos.map(vid => (
                    <tr key={vid.youtubeLinkID}>
                      <td>
                        <img src={vid.thumbnail} alt="thumb" className="analytics-table__thumb" loading="lazy" />
                      </td>
                      <td>
                        <div className="analytics-table__title" title={vid.title}>
                          {vid.title}
                        </div>
                      </td>
                      <td>{vid.group}</td>
                      <td>{vid.category}</td>
                      <td>{new Date(vid.date).toLocaleDateString()}</td>
                      <td>
                        <span className="analytics-table__res-badge" style={{ backgroundColor: getResColor(vid.resolution) }}>{vid.resolution}</span>
                      </td>
                      <td style={{fontWeight: 600}}>{vid.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
