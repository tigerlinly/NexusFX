import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Users, TrendingUp, Search, PlusCircle, User, MessageCircle, Heart, ChevronRight, Hash, Clock, Eye, ThumbsUp, Trophy, Star, Award, Crown, ArrowUp } from 'lucide-react';

export default function ForumsPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Post Form
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  // Comment Form
  const [commentContent, setCommentContent] = useState('');

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await api.getForums({ category: activeCategory, search });
      setPosts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeCategory, search]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      await api.createForumPost({ title: newTitle, content: newContent, category: newCategory });
      setShowNewPost(false);
      setNewTitle('');
      setNewContent('');
      fetchPosts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewPost = async (id) => {
    try {
      const data = await api.getForumPost(id);
      setSelectedPost(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateComment = async (e) => {
    e.preventDefault();
    try {
      await api.createForumComment(selectedPost.post.id, { content: commentContent });
      setCommentContent('');
      handleViewPost(selectedPost.post.id); // refresh comments
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      await api.likeForumPost(postId);
      if (selectedPost && selectedPost.post.id === postId) {
        handleViewPost(postId);
      }
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const categories = [
    { id: '', label: 'ทุกหมวดหมู่', icon: Hash },
    { id: 'general', label: 'พูดคุยทั่วไป', icon: MessageSquare },
    { id: 'analysis', label: 'วิเคราะห์กราฟ', icon: TrendingUp },
    { id: 'signals', label: 'ซิกแนล & ส่งไม้', icon: PlusCircle },
    { id: 'master', label: 'Master Trader', icon: Users },
  ];

  const getCategoryTheme = (catType) => {
    switch (catType) {
      case 'analysis': return 'badge-buy';
      case 'signals': return 'badge-sell';
      case 'master': return 'badge-open';
      default: return 'badge-closed';
    }
  };

  const getRankBadge = (index) => {
    if (index === 0) return { icon: Crown, color: '#FFD700', bg: 'linear-gradient(135deg, #FFD700, #FFA500)', label: '🥇' };
    if (index === 1) return { icon: Award, color: '#C0C0C0', bg: 'linear-gradient(135deg, #C0C0C0, #A0A0A0)', label: '🥈' };
    if (index === 2) return { icon: Star, color: '#CD7F32', bg: 'linear-gradient(135deg, #CD7F32, #B8860B)', label: '🥉' };
    return { icon: ArrowUp, color: 'var(--accent-primary)', bg: 'var(--bg-primary)', label: `#${index + 1}` };
  };

  if (selectedPost) {
    const { post, comments } = selectedPost;
    return (
      <>
        <div className="header">
          <div className="header-left">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedPost(null)} style={{ padding: '4px 8px', marginLeft: -8 }}>
                {'< กลับ'}
              </button>
              กระทู้พูดคุย
            </h1>
          </div>
        </div>
        <div className="content-area">
          <div className="card" style={{ padding: 40, background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0a0e17' }}>
                  {post.avatar_url ? <img src={post.avatar_url} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : post.username[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{post.title}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>@{post.username}</span>
                    <span>• {new Date(post.created_at).toLocaleString('th-TH')}</span>
                    <span className={`badge ${getCategoryTheme(post.category)}`}>{post.category}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)', padding: '24px 0', borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)' }}>
              {post.content.split('\n').map((para, i) => <p key={i} style={{ marginBottom: 12 }}>{para}</p>)}
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 24, color: 'var(--text-tertiary)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={18} /> {post.views} Views</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MessageCircle size={18} /> {comments.length} Comments</div>
              <button 
                onClick={() => handleLikePost(post.id)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, 
                  background: post.is_liked ? 'rgba(239,68,68,0.1)' : 'transparent', 
                  border: post.is_liked ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-primary)',
                  borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
                  color: post.is_liked ? '#ef4444' : 'var(--text-tertiary)',
                  transition: 'all 0.2s', fontWeight: post.is_liked ? 600 : 400,
                  fontSize: 14
                }}
              >
                <Heart size={16} fill={post.is_liked ? '#ef4444' : 'none'} /> {post.like_count} Like{post.like_count > 1 ? 's' : ''}
              </button>
            </div>

            <h3 style={{ marginTop: 40, fontSize: 18, fontWeight: 600, marginBottom: 24 }}>คอมเมนต์ ({comments.length})</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 40 }}>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0 }}>
                    {c.username[0].toUpperCase()}
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: '0 16px 16px 16px', border: '1px solid var(--border-primary)', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>@{c.username}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(c.created_at).toLocaleDateString('th-TH')}</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateComment} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
               <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0 }}>
                 {user.username[0].toUpperCase()}
               </div>
               <div style={{ flex: 1 }}>
                 <textarea 
                   className="form-input" 
                   placeholder="แสดงความคิดเห็นของคุณ..." 
                   rows={3}
                   value={commentContent}
                   onChange={e => setCommentContent(e.target.value)}
                   required
                 />
                 <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                   <button type="submit" className="btn btn-primary">ส่งคอมเมนต์</button>
                 </div>
               </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={20} style={{ color: 'var(--accent-primary)' }} />
            Social Trading Community
          </h1>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={() => setShowNewPost(true)}>
            <PlusCircle size={16} /> ตั้งกระทู้ใหม่
          </button>
        </div>
      </div>

      {showNewPost && (
        <div className="modal-overlay" onClick={() => setShowNewPost(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
            <h2 className="modal-title">ตั้งกระทู้ใหม่</h2>
            <form onSubmit={handleCreatePost}>
              <div className="form-group">
                <label className="form-label">หัวข้อกระทู้</label>
                <input className="form-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} required placeholder="คุณต้องการจะคุยเรื่องอะไร?" />
              </div>
              <div className="form-group">
                <label className="form-label">หมวดหมู่</label>
                <select className="form-input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  <option value="general">พูดคุยทั่วไป</option>
                  <option value="analysis">วิเคราะห์กราฟ</option>
                  <option value="signals">ซิกแนล & ส่งไม้</option>
                  <option value="master">Master Trader</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">รายละเอียด / เนื้อหา</label>
                <textarea className="form-input" value={newContent} onChange={e => setNewContent(e.target.value)} required rows={6} placeholder="พิมพ์อธิบายหรือแสดงความคิดเห็นของคุณที่นี่..."></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewPost(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">ตั้งกระทู้</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-area">
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 'var(--space-xl)' }}>
          {/* Sidebar Navigation for forums */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="ค้นหากระทู้..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, background: 'var(--bg-tertiary)', border: 'none' }} />
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 12px' }}>
              หมวดหมู่ทั้งหมด
            </div>
            
            {categories.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent', border: 'none',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderRadius: 12, cursor: 'pointer', fontWeight: isActive ? 600 : 500, fontSize: 14,
                  textAlign: 'left', transition: 'all 0.2s'
                }}>
                  <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  {cat.label}
                </button>
              );
            })}
            
            <div className="card" style={{ marginTop: 24, background: 'var(--bg-tertiary)', padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)'}}>💡 กฎกติกาแชทบอร์ด</h3>
              <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>ห้ามสแปมข้อความซ้ำซ้อน</li>
                <li>แลกเปลี่ยนมุมมองโดยสุภาพชน</li>
                <li>งดการเชิญชวนโบรกเกอร์อื่นโดยไม่ได้รับอนุญาต</li>
              </ul>
            </div>
          </div>

          {/* Forum Posts List */}
          <div>
            {loading ? (
               <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-tertiary)' }}>กำลังดึงข้อมูล...</div>
            ) : posts.length === 0 ? (
               <div className="card" style={{ textAlign: 'center', padding: 80, background: 'var(--bg-tertiary)', border: 'none' }}>
                 <MessageSquare size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                 <h3 style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>ไม่มีกระทู้ในหมวดหมู่นี้</h3>
                 <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>มาร่วมเป็นคนแรกที่สร้างกระทู้คุยกัน</p>
               </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {posts.map(post => (
                  <div key={post.id} className="card hover-glow" onClick={() => handleViewPost(post.id)} style={{ cursor: 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', padding: 24, transition: 'transform 0.2s, box-shadow 0.2s', display: 'flex', gap: 20 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0, border: '1px solid var(--border-primary)' }}>
                      {post.avatar_url ? <img src={post.avatar_url} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : post.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{post.title}</h3>
                        <span className={`badge ${getCategoryTheme(post.category)}`}>{post.category}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.content}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={14} /> @{post.username}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} /> {new Date(post.created_at).toLocaleDateString('th-TH')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                          <Heart size={14} /> {post.like_count}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MessageCircle size={14} /> {post.comment_count}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard Sidebar */}
          <div>
            <div className="card" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                padding: '20px 24px', 
                background: 'linear-gradient(135deg, rgba(0,210,165,0.1), rgba(0,180,220,0.1))',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <Trophy size={20} style={{ color: '#FFD700' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🏆 Leaderboard</h3>
              </div>
              
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
                    ยังไม่มีข้อมูล
                  </div>
                ) : leaderboard.map((member, idx) => {
                  const rank = getRankBadge(idx);
                  return (
                    <div key={member.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                      borderRadius: 10, transition: 'background 0.2s',
                      background: idx < 3 ? `${rank.bg}10` : 'transparent'
                    }}>
                      <div style={{ 
                        width: 28, height: 28, borderRadius: '50%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: idx < 3 ? 16 : 12, fontWeight: 700,
                        color: idx < 3 ? rank.color : 'var(--text-muted)',
                        flexShrink: 0
                      }}>
                        {rank.label}
                      </div>
                      <div style={{ 
                        width: 32, height: 32, borderRadius: '50%', 
                        background: 'var(--bg-primary)', border: `2px solid ${idx < 3 ? rank.color : 'var(--border-primary)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0
                      }}>
                        {member.avatar_url ? 
                          <img src={member.avatar_url} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : 
                          member.username[0].toUpperCase()
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {member.display_name || member.username}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span>{member.post_count}p</span>
                          <span>{member.comment_count}c</span>
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: 11, fontWeight: 700, 
                        color: idx < 3 ? rank.color : 'var(--accent-primary)',
                        background: idx < 3 ? `${rank.color}15` : 'rgba(0,210,165,0.1)',
                        padding: '3px 8px', borderRadius: 6
                      }}>
                        {member.reputation_score}pt
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats Card */}
            <div className="card" style={{ marginTop: 16, background: 'var(--bg-tertiary)', padding: 20, border: '1px solid var(--border-primary)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>📊 สถิติคอมมูนิตี้</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-primary)', borderRadius: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-primary)' }}>{posts.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>กระทู้ทั้งหมด</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-primary)', borderRadius: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#FFD700' }}>{leaderboard.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>สมาชิกแอคทีฟ</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
