import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  ArrowLeft, RefreshCw, Activity, Users, Clock, 
  CheckCircle2, AlertCircle, BarChart2 
} from 'lucide-react';

type TimeRange = 7 | 30 | 90;

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6'];

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<TimeRange>(30);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  const [overview, setOverview] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [sourcesData, setSourcesData] = useState<any[]>([]);
  const [queueData, setQueueData] = useState<any[]>([]);
  const [errorsData, setErrorsData] = useState<any[]>([]);
  const [lorasData, setLorasData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoints = ['overview', 'daily', 'hourly', 'models', 'users', 'sources', 'queue', 'errors', 'loras', 'activity'];
      const requests = endpoints.map(ep => {
        const queryParams = new URLSearchParams({ days: days.toString() });
        if (ep !== 'sources' && sourceFilter !== 'all') {
          queryParams.append('source', sourceFilter);
        }
        return fetch(`/api/analytics/${ep}?${queryParams.toString()}`).then(res => {
          if (!res.ok) {
            if (res.status === 403 || res.status === 401) throw new Error('403');
            throw new Error('fetch error');
          }
          return res.json();
        });
      });
      
      const [overviewRes, dailyRes, hourlyRes, modelsRes, usersRes, sourcesRes, queueRes, errorsRes, lorasRes, activityRes] = await Promise.all(requests);
      
      setOverview(overviewRes.overview);
      
      // format daily
      setDailyData(dailyRes.daily.map((item: any) => ({
        ...item,
        dateMatch: item.date.substring(5) // MM-DD
      })));
      
      // format hourly (0-23)
      const formattedHourly = Array.from({ length: 24 }).map((_, i) => {
        const found = hourlyRes.hourly.find((h: any) => h.hour === i);
        return {
          hour: `${i}:00`,
          count: found ? found.count : 0
        };
      });
      setHourlyData(formattedHourly);
      
      setModelsData(modelsRes.models);
      setUsersData(usersRes.users.slice(0, 10)); // Top 10
      
      const SOURCE_NAMES: Record<string, string> = {
        'comfy_standard': '标准生图',
        'comfy_duo': '双人生图',
        'video': '图生视频',
        'novelai': '二次元(NAI)',
        'comfyui': '未知/旧数据'
      };

      setSourcesData(sourcesRes.sources
        .filter((s: any) => s.source !== 'test-script')
        .map((s: any) => ({
          ...s,
          displayName: SOURCE_NAMES[s.source] || s.source
        })));

      const formattedQueue = Array.from({ length: 24 }).map((_, i) => {
        const found = queueRes.queueStats.find((h: any) => h.hour === i);
        return {
          hour: `${i}:00`,
          avg_queue_sec: found ? Math.round(found.avg_queue_ms / 1000) : 0
        };
      });
      setQueueData(formattedQueue);
      setErrorsData(errorsRes.errors || []);
      setLorasData(lorasRes.loras || []);
      setActivityData(activityRes.activity || []);
      
    } catch (err: any) {
      console.error(err);
      if (err.message === '403') {
        setError('需要管理员权限方可查看本页');
      } else {
        setError('获取统计数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days, sourceFilter]);

  if (error) {
    return (
      <div className="min-h-screen bg-darker flex flex-col items-center justify-center p-4">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">{error}</h2>
        <Link to="/" className="text-primary hover:underline mt-4 flex items-center gap-2">
          <ArrowLeft size={16} /> 返回首页
        </Link>
      </div>
    );
  }

  const successRate = overview && overview.total > 0 
    ? Math.round((overview.success_count / overview.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-darker text-gray-100 p-4 lg:p-8 font-sans selection:bg-primary/30 overflow-y-auto">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-surface hover:bg-white/10 rounded-xl transition-colors border border-white/10"
            >
              <ArrowLeft size={20} className="text-gray-400 group-hover:text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="text-primary" />
                生图数据分析
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-surface p-1.5 rounded-xl border border-white/10">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-darker text-gray-300 border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none cursor-pointer focus:border-primary hover:border-white/20 transition-colors"
            >
              <option value="all">全局维度</option>
              <option value="novelai">二次元(NAI)</option>
              <option value="comfy_standard">标准生图(Comfy)</option>
              <option value="comfy_duo">双人生图(Comfy)</option>
              <option value="video">图生视频(Comfy)</option>
            </select>
            <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0"></div>
            {(['7', '30', '90'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDays(parseInt(d) as TimeRange)}
                className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                  days === parseInt(d) 
                    ? 'bg-primary text-white font-medium shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                近 {d} 天
              </button>
            ))}
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button 
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : ''} />
            </button>
          </div>
        </div>

        {loading && !overview ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="animate-spin text-primary"><RefreshCw size={32} /></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={48} className="text-primary" />
                </div>
                <p className="text-sm text-gray-400 mb-1">总生成量</p>
                <div className="text-3xl font-bold text-white tracking-tight">{overview?.total || 0}</div>
              </div>
              
              <div className="bg-surface border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CheckCircle2 size={48} className="text-green-500" />
                </div>
                <p className="text-sm text-gray-400 mb-1">成功率</p>
                <div className="text-3xl font-bold text-white tracking-tight flex items-baseline gap-1">
                  <span className={successRate < 80 ? 'text-orange-400' : 'text-green-400'}>{successRate}%</span>
                </div>
              </div>

              <div className="bg-surface border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users size={48} className="text-blue-500" />
                </div>
                <p className="text-sm text-gray-400 mb-1">活跃用户</p>
                <div className="text-3xl font-bold text-white tracking-tight">{overview?.active_users || 0}</div>
              </div>

              <div className="bg-surface border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Clock size={48} className="text-purple-500" />
                </div>
                <p className="text-sm text-gray-400 mb-1">平均耗时</p>
                <div className="text-3xl font-bold text-white tracking-tight flex items-baseline gap-1">
                  {(overview?.avg_duration_ms / 1000).toFixed(1)} <span className="text-sm text-gray-500 font-normal">s</span>
                </div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-white/5 p-5 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-6">每日生成趋势</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="dateMatch" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} width={40} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                        itemStyle={{ color: '#e5e7eb' }}
                      />
                      <Legend />
                      <Line type="monotone" name="总生成量" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="成功生成" dataKey="success_count" stroke="#10b981" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-surface border border-white/5 p-5 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-6">24小时请求分布</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} interval={2} />
                      <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} width={40} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                      />
                      <Bar name="请求量" dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 1.5 - Queue Stats */}
            <div className="bg-surface border border-white/5 p-5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-6">24小时排队等待耗时 (秒)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={queueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} interval={2} />
                    <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} width={40} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                      itemStyle={{ color: '#e5e7eb' }}
                      formatter={(value: number) => [`${value} s`, '平均排队']}
                    />
                    <Area type="monotone" name="平均排队" dataKey="avg_queue_sec" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorQueue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Models */}
              <div className="bg-surface border border-white/5 p-5 rounded-2xl lg:col-span-2">
                <h3 className="text-lg font-bold text-white mb-6">模型使用排行</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelsData.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="model" type="category" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} width={120} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                      />
                      <Bar name="数量" dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sources Pie */}
              <div className="bg-surface border border-white/5 p-5 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-6">生图来源分布</h3>
                <div className="h-72 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourcesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="displayName"
                        label={({ displayName, percent }) => `${displayName} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {sourcesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                        itemStyle={{ color: '#e5e7eb' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 2.5 - LoRAs */}
            <div className="bg-surface border border-white/5 p-5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-6">最受欢迎的 LoRA (Top 15)</h3>
              <div className="h-72 w-full">
                {lorasData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    暂无 LoRA 使用记录，或者尚未积累有效数据
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lorasData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="lora_name" type="category" stroke="#e5e7eb" fontSize={11} tickLine={false} axisLine={false} width={180} 
                        tickFormatter={(val) => val && val.length > 25 ? val.substring(0, 25) + '...' : val}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                        formatter={(value: number) => [value, '生图使用次数']}
                      />
                      <Bar name="次数" dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            
            {/* Users Ranking Table */}
            <div className="bg-surface border border-white/5 p-5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4">活跃用户排行 (Top 10)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-sm">
                      <th className="pb-3 pl-2 font-medium">排名</th>
                      <th className="pb-3 font-medium">用户</th>
                      <th className="pb-3 font-medium text-right">总请求量</th>
                      <th className="pb-3 font-medium text-right">图片生成量</th>
                      <th className="pb-3 pr-2 font-medium text-right">成功率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-gray-500">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      usersData.map((u, i) => {
                        const rate = u.count > 0 ? Math.round((u.success_count / u.count) * 100) : 0;
                        return (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 pl-2 text-gray-400">#{i + 1}</td>
                            <td className="py-3 font-medium text-white">{u.username || `User ${u.user_id}`}</td>
                            <td className="py-3 text-right text-gray-300">{u.count}</td>
                            <td className="py-3 text-right text-gray-300">{u.total_images}</td>
                            <td className="py-3 pr-2 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rate >= 80 ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Row 3 - Errors */}
            <div className="bg-surface border border-white/5 p-5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-6">Top 系统拦截及报错原因 (Top 10)</h3>
              <div className="h-72 w-full">
                {errorsData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    目前生图全部成功，暂无报错拦截记录
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={errorsData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="error_message" type="category" stroke="#e5e7eb" fontSize={11} tickLine={false} axisLine={false} width={260} 
                        tickFormatter={(val) => val && val.length > 35 ? val.substring(0, 35) + '...' : val}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                        formatter={(value: number) => [value, '出现次数']}
                      />
                      <Bar name="次数" dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Charts Row 4 - Activity Heatmap */}
            <div className="bg-surface border border-white/5 p-5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-6">用户活跃时段分布</h3>
              <div className="h-72 w-full">
                {activityData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    暂无活动时段记录
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" dataKey="hour" name="时间段 (时)" ticks={[0,3,6,9,12,15,18,21,23]} stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis type="number" dataKey="weekday" name="星期" ticks={[0,1,2,3,4,5,6]} stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                        tickFormatter={(val) => ['周日','周一','周二','周三','周四','周五','周六'][val]} />
                      <ZAxis type="number" dataKey="count" range={[20, 400]} name="请求量" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} 
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                        formatter={(value, name) => {
                          if (name === '星期') return [['周日','周一','周二','周三','周四','周五','周六'][value as number], name];
                          return [value, name];
                        }}
                      />
                      <Scatter name="活跃请求分布" data={activityData} fill="#14b8a6" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
