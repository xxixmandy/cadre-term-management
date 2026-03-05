'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Plus, 
  Upload, 
  Edit2, 
  Trash2, 
  Bell, 
  Download,
  SortAsc,
  SortDesc,
  Users,
  Settings,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { formatDate, getDaysUntilExpiry } from '@/lib/cadre-utils';

interface Cadre {
  id: number;
  name: string;
  gender: string | null;
  birth_date: string | null;
  department: string | null;
  position: string | null;
  term_start_date: string | null;
  term_duration: number | null;
  term_end_date: string | null;
  term_end_date_original: string | null;
  retirement_date: string | null;
  status: string;
  remarks: string | null;
  is_temporary: boolean;
  created_at: string;
  updated_at: string | null;
}

interface FormData {
  name: string;
  gender: string;
  birthDate: string;
  department: string;
  position: string;
  termStartDate: string;
  termDuration: string;
  termEndDate: string;
  remarks: string;
  isTemporary: boolean;
}

const initialFormData: FormData = {
  name: '',
  gender: '',
  birthDate: '',
  department: '',
  position: '',
  termStartDate: '',
  termDuration: '',
  termEndDate: '',
  remarks: '',
  isTemporary: false,
};

export default function CadreManagementPage() {
  const [cadres, setCadres] = useState<Cadre[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('term_end_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCadre, setEditingCadre] = useState<Cadre | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  
  // 设置相关状态
  const [settingsTab, setSettingsTab] = useState('list');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notifyMessage, setNotifyMessage] = useState('');

  // 获取干部列表
  const fetchCadres = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        search: searchQuery,
      });
      const response = await fetch(`/api/cadres?${params}`);
      const result = await response.json();
      if (result.data) {
        setCadres(result.data);
      }
    } catch (error) {
      console.error('获取干部列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, searchQuery]);

  // 获取webhook设置
  const fetchWebhookSetting = useCallback(async () => {
    try {
      const response = await fetch('/api/settings?key=webhook_url');
      const result = await response.json();
      if (result.data) {
        setWebhookUrl(result.data);
      }
    } catch (error) {
      console.error('获取webhook设置失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchCadres();
    fetchWebhookSetting();
  }, [fetchCadres, fetchWebhookSetting]);

  // 保存webhook设置
  const saveWebhook = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'webhook_url',
          value: webhookUrl,
          description: '企业微信Webhook地址',
        }),
      });
      const result = await response.json();
      if (result.error) {
        alert('保存失败: ' + result.error);
        return;
      }
      alert('保存成功');
    } catch (error) {
      console.error('保存webhook失败:', error);
      alert('保存失败');
    }
  };

  // 测试webhook
  const testWebhook = async () => {
    if (!webhookUrl) {
      alert('请先输入Webhook地址');
      return;
    }
    
    setWebhookStatus('testing');
    setWebhookMessage('');
    
    try {
      // 先保存
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'webhook_url',
          value: webhookUrl,
          description: '企业微信Webhook地址',
        }),
      });
      
      // 再测试连接
      const response = await fetch('/api/settings/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });
      const result = await response.json();
      
      if (result.success) {
        setWebhookStatus('success');
        setWebhookMessage(result.message);
      } else {
        setWebhookStatus('error');
        setWebhookMessage(result.message);
      }
    } catch (error) {
      setWebhookStatus('error');
      setWebhookMessage('测试失败');
    }
  };

  // 发送提醒
  const sendNotifications = async (testMode: boolean = false) => {
    setNotifyStatus('sending');
    setNotifyMessage('');
    
    try {
      const response = await fetch('/api/cadres/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode }),
      });
      const result = await response.json();
      
      if (result.error) {
        setNotifyStatus('error');
        setNotifyMessage(result.error);
      } else {
        setNotifyStatus('success');
        setNotifyMessage(result.message + (result.notifications ? `\n已发送: ${result.notifications.filter((n: { success: boolean }) => n.success).length} 条` : ''));
      }
    } catch (error) {
      setNotifyStatus('error');
      setNotifyMessage('发送失败');
    }
  };

  // 添加或更新干部
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        name: formData.name,
        gender: formData.gender || null,
        birthDate: formData.birthDate || null,
        department: formData.department || null,
        position: formData.position || null,
        termStartDate: formData.termStartDate || null,
        termDuration: formData.termDuration ? parseInt(formData.termDuration) : null,
        termEndDate: formData.termEndDate || null,
        remarks: formData.remarks || null,
        isTemporary: formData.isTemporary,
      };

      if (editingCadre) {
        const response = await fetch(`/api/cadres/${editingCadre.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        });
        const result = await response.json();
        if (result.error) {
          alert('更新失败: ' + result.error);
          return;
        }
      } else {
        const response = await fetch('/api/cadres', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        });
        const result = await response.json();
        if (result.error) {
          alert('添加失败: ' + result.error);
          return;
        }
      }
      
      setDialogOpen(false);
      setFormData(initialFormData);
      setEditingCadre(null);
      fetchCadres();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  // 删除干部
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此干部信息吗？')) return;
    
    try {
      const response = await fetch(`/api/cadres/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.error) {
        alert('删除失败: ' + result.error);
        return;
      }
      fetchCadres();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 导入文件
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataObj = new FormData();
    formDataObj.append('file', file);

    try {
      const response = await fetch('/api/cadres/import', {
        method: 'POST',
        body: formDataObj,
      });
      const result = await response.json();
      if (result.error) {
        alert('导入失败: ' + result.error + (result.warnings ? '\n' + result.warnings.slice(0, 5).join('\n') : ''));
        return;
      }
      // 显示导入结果，包含表头信息
      let message = result.message;
      if (result.headers && result.headers.length > 0) {
        message += '\n\n文件表头列名:\n' + result.headers.join(', ');
      }
      if (result.warnings) {
        message += '\n\n警告:\n' + result.warnings.slice(0, 5).join('\n');
      }
      alert(message);
      fetchCadres();
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败');
    }
    
    e.target.value = '';
  };

  // 导出CSV
  const handleExport = () => {
    const headers = ['姓名', '性别', '出生日期', '部门', '岗位', '任期开始', '任期结束', '状态', '备注'];
    const rows = cadres.map(c => [
      c.name,
      c.gender || '',
      c.birth_date || '',
      c.department || '',
      c.position || '',
      c.term_start_date || '',
      c.term_end_date || '',
      c.status,
      c.remarks || '',
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `干部任期花名册_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // 获取状态样式
  const getStatusBadge = (status: string, termEndDate: string | null) => {
    if (!termEndDate) {
      return <Badge variant="outline">未知</Badge>;
    }
    
    const days = getDaysUntilExpiry(termEndDate);
    
    if (status === '已到期') {
      return <Badge variant="destructive">{status}</Badge>;
    }
    if (status === '即将到期') {
      return <Badge variant="secondary" className="bg-orange-500 text-white">{status} ({days}天)</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">{status}</Badge>;
  };

  // 打开编辑对话框
  const openEditDialog = (cadre: Cadre) => {
    setEditingCadre(cadre);
    setFormData({
      name: cadre.name,
      gender: cadre.gender || '',
      birthDate: cadre.birth_date || '',
      department: cadre.department || '',
      position: cadre.position || '',
      termStartDate: cadre.term_start_date || '',
      termDuration: cadre.term_duration?.toString() || '',
      termEndDate: cadre.term_end_date || '',
      remarks: cadre.remarks || '',
      isTemporary: cadre.is_temporary,
    });
    setDialogOpen(true);
  };

  // 打开添加对话框
  const openAddDialog = () => {
    setEditingCadre(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 头部 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  干部任期管理程序
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  干部任期信息管理与自动提醒系统
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1" />
                    导入
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-1" />
                添加干部
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={settingsTab} onValueChange={setSettingsTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              干部列表
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              提醒设置
            </TabsTrigger>
          </TabsList>

          {/* 干部列表 */}
          <TabsContent value="list">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    干部花名册
                    <span className="text-sm font-normal text-gray-500">
                      共 {cadres.length} 人
                    </span>
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="搜索姓名、部门、岗位..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="排序方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="term_end_date">到期时间</SelectItem>
                        <SelectItem value="term_start_date">任职时间</SelectItem>
                        <SelectItem value="status">状态</SelectItem>
                        <SelectItem value="name">姓名</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? (
                        <SortAsc className="h-4 w-4" />
                      ) : (
                        <SortDesc className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : cadres.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无数据，请添加干部信息或导入数据
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>姓名</TableHead>
                          <TableHead>性别</TableHead>
                          <TableHead>出生日期</TableHead>
                          <TableHead>部门</TableHead>
                          <TableHead>岗位</TableHead>
                          <TableHead>任期开始</TableHead>
                          <TableHead>任期结束</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>备注</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cadres.map((cadre) => (
                          <TableRow key={cadre.id} className={cadre.status === '已到期' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                            <TableCell className="font-medium">{cadre.name}</TableCell>
                            <TableCell>{cadre.gender || '-'}</TableCell>
                            <TableCell>{cadre.birth_date ? formatDate(cadre.birth_date) : '-'}</TableCell>
                            <TableCell>{cadre.department || '-'}</TableCell>
                            <TableCell>{cadre.position || '-'}</TableCell>
                            <TableCell>{cadre.term_start_date ? formatDate(cadre.term_start_date) : '-'}</TableCell>
                            <TableCell>
                              {cadre.term_end_date_original ? (
                                // 有原始完整描述时显示原始描述
                                <span className="text-sm" title={`排序日期: ${cadre.term_end_date ? formatDate(cadre.term_end_date) : '-'}`}>
                                  {cadre.term_end_date_original}
                                </span>
                              ) : (
                                // 没有原始描述时显示日期
                                <>
                                  {cadre.term_end_date ? formatDate(cadre.term_end_date) : '-'}
                                  {cadre.is_temporary && (
                                    <span className="text-xs text-orange-500 ml-1">(暂定)</span>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(cadre.status, cadre.term_end_date)}
                            </TableCell>
                            <TableCell className="max-w-32 truncate" title={cadre.remarks || ''}>
                              {cadre.remarks || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(cadre)}
                                  title="编辑"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(cadre.id)}
                                  title="删除"
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 提醒设置 */}
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Webhook配置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    企业微信通知设置
                  </CardTitle>
                  <CardDescription>
                    配置企业微信群机器人Webhook地址，系统将在任期结束前两个月、半个月、一天自动发送提醒
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="webhook">Webhook地址</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="webhook"
                          placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                        <Button onClick={saveWebhook}>保存</Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Button 
                      variant="outline" 
                      onClick={testWebhook}
                      disabled={webhookStatus === 'testing'}
                    >
                      {webhookStatus === 'testing' ? (
                        <>
                          <div className="animate-spin h-4 w-4 mr-2 border-2 border-current rounded-full border-t-transparent" />
                          测试中...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          测试连接
                        </>
                      )}
                    </Button>
                    
                    {webhookStatus === 'success' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">{webhookMessage}</span>
                      </div>
                    )}
                    
                    {webhookStatus === 'error' && (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">{webhookMessage}</span>
                      </div>
                    )}
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>如何获取Webhook地址：</strong>
                      <br />
                      1. 在企业微信群中添加群机器人
                      <br />
                      2. 选择"自定义机器人"
                      <br />
                      3. 完成配置后复制Webhook地址
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* 手动发送提醒 */}
              <Card>
                <CardHeader>
                  <CardTitle>手动发送提醒</CardTitle>
                  <CardDescription>
                    点击按钮立即检查并发送任期提醒通知
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <Button 
                      onClick={() => sendNotifications(false)}
                      disabled={notifyStatus === 'sending' || !webhookUrl}
                    >
                      {notifyStatus === 'sending' ? (
                        <>
                          <div className="animate-spin h-4 w-4 mr-2 border-2 border-current rounded-full border-t-transparent" />
                          发送中...
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4 mr-2" />
                          发送今日提醒
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => sendNotifications(true)}
                      disabled={notifyStatus === 'sending' || !webhookUrl}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      测试发送（发送所有60天内到期通知）
                    </Button>
                  </div>

                  {notifyStatus === 'success' && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        {notifyMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {notifyStatus === 'error' && (
                    <Alert className="bg-red-50 border-red-200">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {notifyMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-sm text-gray-500">
                    <p><strong>提醒规则：</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>任期结束前两个月（60天）提醒</li>
                      <li>任期结束前半个月（15天）提醒</li>
                      <li>任期结束前一天提醒</li>
                      <li>自动提醒在每天早上8:30执行</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCadre ? '编辑干部信息' : '添加干部'}
            </DialogTitle>
            <DialogDescription>
              姓名为必填项，其他信息可选填
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">基本信息</TabsTrigger>
                <TabsTrigger value="term">任期信息</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">姓名 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="必填"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">性别</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(v) => setFormData({ ...formData, gender: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="男">男</SelectItem>
                        <SelectItem value="女">女</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="birthDate">出生日期</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">任职部门</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="如：组织部"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="position">任职岗位</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="如：部长"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="term" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="termStartDate">任期开始时间</Label>
                  <Input
                    id="termStartDate"
                    type="date"
                    value={formData.termStartDate}
                    onChange={(e) => setFormData({ ...formData, termStartDate: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="termDuration">任期时长（月）</Label>
                    <Input
                      id="termDuration"
                      type="number"
                      placeholder="如：36（表示3年）"
                      value={formData.termDuration}
                      onChange={(e) => setFormData({ ...formData, termDuration: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="termEndDate">任期结束日期</Label>
                    <Input
                      id="termEndDate"
                      type="date"
                      value={formData.termEndDate}
                      onChange={(e) => setFormData({ ...formData, termEndDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="remarks">备注</Label>
                  <Textarea
                    id="remarks"
                    placeholder="备注信息"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isTemporary"
                    checked={formData.isTemporary}
                    onChange={(e) => setFormData({ ...formData, isTemporary: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="isTemporary" className="font-normal">
                    此结束时间为暂定时间
                  </Label>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingCadre ? '保存修改' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
