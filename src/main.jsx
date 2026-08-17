import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShoppingCart, Search, LogIn, UserPlus, ClipboardList, Plus, Minus, X, Utensils, ShieldCheck } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function api(path, options = {}) {
  const token = localStorage.getItem('ggsh_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  return data;
}

function App() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('ggsh_cart') || '[]'));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('ggsh_user') || 'null'));
  const [showCart, setShowCart] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', pin: '' });

  useEffect(() => {
    api('/menu').then(data => setMenu(Array.isArray(data) ? data : data?.items || data?.menu || [])).catch(e => setError(`Could not load menu: ${e.message}`));
  }, []);

  useEffect(() => localStorage.setItem('ggsh_cart', JSON.stringify(cart)), [cart]);

  const categories = useMemo(() => ['All', ...new Set(menu.map(x => x.category).filter(Boolean))], [menu]);
  const filtered = useMemo(() => menu.filter(item => {
    const matchesCategory = category === 'All' || item.category === category;
    const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
    return matchesCategory && text.includes(query.toLowerCase());
  }), [menu, category, query]);
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  function add(item) {
    setCart(c => {
      const found = c.find(x => x.id === item.id);
      return found ? c.map(x => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x) : [...c, { ...item, quantity: 1 }];
    });
    setNotice(`${item.name} added to cart`);
    setTimeout(() => setNotice(''), 1800);
  }
  function change(id, delta) {
    setCart(c => c.map(x => x.id === id ? { ...x, quantity: x.quantity + delta } : x).filter(x => x.quantity > 0));
  }

  async function submitAuth(e) {
    e.preventDefault(); setError('');
    try {
      const path = authMode === 'login' ? '/client-auth/login' : '/client-auth/register';
      const body = authMode === 'login' ? { email: form.email, password: form.password } : form;
      const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
      const token = data.token || data.accessToken;
      const user = data.user || data.client || data;
      if (token) localStorage.setItem('ggsh_token', token);
      localStorage.setItem('ggsh_user', JSON.stringify(user));
      setAuth(user); setShowAuth(false); setNotice('Welcome to GGSH Canteen');
    } catch (e) { setError(e.message); }
  }

  async function checkout() {
    if (!auth) { setShowCart(false); setShowAuth(true); return; }
    try {
      const payload = { items: cart.map(x => ({ menuItemId: x.id, quantity: x.quantity })) };
      await api('/orders', { method: 'POST', body: JSON.stringify(payload) });
      setCart([]); setShowCart(false); setNotice('Order placed successfully');
    } catch (e) { setError(`Order failed: ${e.message}`); }
  }

  async function loadOrders() {
    try {
      const data = await api('/orders');
      setOrders(Array.isArray(data) ? data : data?.orders || []); setShowOrders(true);
    } catch (e) { setError(e.message); }
  }

  function logout() { localStorage.removeItem('ggsh_token'); localStorage.removeItem('ggsh_user'); setAuth(null); }

  return <div className="app">
    <header className="header">
      <div className="brand"><div className="logo"><Utensils size={22}/></div><div><strong>GGSH Canteen</strong><span>Hospital Food Ordering</span></div></div>
      <nav>
        {auth && <button className="nav-btn" onClick={loadOrders}><ClipboardList size={18}/> My Orders</button>}
        {auth ? <button className="nav-btn" onClick={logout}>Logout</button> : <button className="nav-btn primary" onClick={() => setShowAuth(true)}><LogIn size={18}/> Sign in</button>}
        <button className="cart-btn" onClick={() => setShowCart(true)}><ShoppingCart size={20}/><b>{cart.reduce((n,x) => n+x.quantity, 0)}</b></button>
      </nav>
    </header>

    <main>
      <section className="hero"><div><p className="eyebrow">GOLDEN GATE SHOPPING HOSPITAL</p><h1>Fresh meals, <span>made simple.</span></h1><p>Order meals and refreshments from the GGSH Canteen and have your order ready for collection.</p></div><div className="hero-icon"><Utensils size={80}/></div></section>
      <div className="toolbar"><div className="search"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search meals..."/></div><div className="categories">{categories.map(c => <button className={category === c ? 'active' : ''} onClick={() => setCategory(c)} key={c}>{c}</button>)}</div></div>
      {error && <div className="alert error">{error}<button onClick={() => setError('')}><X size={16}/></button></div>}
      {notice && <div className="alert success">{notice}</div>}
      <section className="grid">{filtered.map(item => <article className="card" key={item.id}><div className="food-image">{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <Utensils size={38}/>}</div><div className="card-body"><div className="card-top"><h3>{item.name}</h3><strong>GH₵ {Number(item.price || 0).toFixed(2)}</strong></div><p>{item.description || 'Freshly prepared at GGSH Canteen.'}</p><button onClick={() => add(item)}><Plus size={17}/> Add to cart</button></div></article>)}</section>
      {!filtered.length && <div className="empty"><Utensils size={42}/><h3>No meals found</h3><p>Try another search or category.</p></div>}
    </main>

    {showCart && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setShowCart(false)}><aside className="drawer"><div className="drawer-head"><h2>Your Cart</h2><button onClick={() => setShowCart(false)}><X/></button></div>{cart.length ? <>{cart.map(x => <div className="cart-row" key={x.id}><div><b>{x.name}</b><small>GH₵ {Number(x.price).toFixed(2)} each</small></div><div className="qty"><button onClick={() => change(x.id,-1)}><Minus size={14}/></button><b>{x.quantity}</b><button onClick={() => change(x.id,1)}><Plus size={14}/></button></div></div>)}<div className="total"><span>Total</span><b>GH₵ {total.toFixed(2)}</b></div><button className="checkout" onClick={checkout}>Place Order</button></> : <div className="empty"><ShoppingCart size={42}/><p>Your cart is empty.</p></div>}</aside></div>}

    {showAuth && <div className="overlay"><div className="modal"><button className="close" onClick={() => setShowAuth(false)}><X/></button><div className="modal-icon">{authMode === 'login' ? <LogIn/> : <UserPlus/>}</div><h2>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2><p>{authMode === 'login' ? 'Sign in to place and track orders.' : 'Create your GGSH Canteen account.'}</p><form onSubmit={submitAuth}>{authMode === 'register' && <input placeholder="Full name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>}<input type="email" placeholder="Email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>{authMode === 'register' && <input placeholder="Phone number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>}<input type="password" placeholder="Password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button className="submit">{authMode === 'login' ? 'Sign in' : 'Register'}</button></form><button className="switch" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login' ? 'New customer? Create an account' : 'Already have an account? Sign in'}</button></div></div>}

    {showOrders && <div className="overlay"><div className="modal wide"><button className="close" onClick={() => setShowOrders(false)}><X/></button><h2>My Orders</h2>{orders.length ? orders.map((o,i)=><div className="order" key={o.id || i}><div><b>Order #{o.id || i+1}</b><span>{o.status || 'Pending'}</span></div><strong>GH₵ {Number(o.total || o.totalAmount || 0).toFixed(2)}</strong></div>) : <div className="empty"><ClipboardList size={40}/><p>No orders yet.</p></div>}</div></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
