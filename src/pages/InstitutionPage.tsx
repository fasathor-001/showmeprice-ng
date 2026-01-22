
import React, { useState } from 'react';
import { useInstitution } from '../hooks/useInstitution';
import SEO from '../components/common/SEO';

interface InstitutionPageProps {
    onNavigateHome: () => void;
}

export default function InstitutionPage({ onNavigateHome }: InstitutionPageProps) {
    const { institution, logs, loading, createInstitution, addToProcurement, markAsPurchased, deleteLog } = useInstitution();
    
    // Activation Form State
    const [activateForm, setActivateForm] = useState({ name: '', type: 'School', address: '' });
    const [isActivating, setIsActivating] = useState(false);

    // Manual Add State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: '', qty: '1' });

    // Activation Handler
    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActivating(true);
        await createInstitution(activateForm.name, activateForm.type, activateForm.address);
        setIsActivating(false);
    };

    // Manual Add Handler
    const handleManualAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name || !newItem.price) return;
        await addToProcurement({
            name: newItem.name,
            price: parseFloat(newItem.price),
            qty: parseInt(newItem.qty)
        });
        setNewItem({ name: '', price: '', qty: '1' });
        setIsAddOpen(false);
    };

    // Analytics
    const totalPlanned = logs.filter(l => l.status === 'planned').reduce((acc, curr) => acc + (curr.unit_price * curr.quantity), 0);
    const totalSpent = logs.filter(l => l.status === 'purchased').reduce((acc, curr) => acc + (curr.unit_price * curr.quantity), 0);

    // Export Handler
    const handleExport = () => {
        const headers = ["Item Name", "Quantity", "Unit Price", "Total", "Status", "Date"];
        const rows = logs.map(l => [
            l.products?.title || l.custom_item_name,
            l.quantity,
            l.unit_price,
            l.quantity * l.unit_price,
            l.status,
            new Date(l.created_at).toLocaleDateString()
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "procurement_log.csv");
        document.body.appendChild(link);
        link.click();
        
        // Fix: Safer removal to prevent "Node not found" error
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 100);
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-12 flex justify-center">
                <div className="skeleton w-full max-w-2xl h-64 rounded-xl"></div>
            </div>
        );
    }

    // --- ACTIVATION VIEW ---
    if (!institution) {
        return (
            <div className="container mx-auto px-4 py-12 animate-view max-w-2xl">
                <SEO title="Institution Tools - Procurement & RFQ" description="Streamline procurement for schools, NGOs, and companies in Nigeria." />
                
                <button onClick={onNavigateHome} className="text-sm text-slate-500 hover:text-brand font-bold flex items-center gap-1 mb-8">
                    <ArrowLeft className="" /> Back to Marketplace
                </button>

                <div className="bg-white rounded-2xl border shadow-xl overflow-hidden">
                    <div className="bg-slate-900 text-white p-8 text-center">
                        <ArrowLeft className="" />
                        <h1 className="text-2xl font-black mb-2">Activate Institution Tools</h1>
                        <p className="text-slate-300">For Schools, NGOs, Companies, and Government Parastatals.</p>
                    </div>
                    
                    <div className="p-8">
                        <ul className="space-y-4 mb-8">
                            <li className="flex gap-3 text-sm text-slate-700">
                                <div className="bg-brand/10 text-brand rounded-full p-1"><ArrowLeft className="" /></div>
                                <span>Create and manage procurement lists</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-700">
                                <div className="bg-brand/10 text-brand rounded-full p-1"><ArrowLeft className="" /></div>
                                <span>Track spending and budget analytics</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-700">
                                <div className="bg-brand/10 text-brand rounded-full p-1"><ArrowLeft className="" /></div>
                                <span>Export reports for approval</span>
                            </li>
                        </ul>

                        <form onSubmit={handleActivate} className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-1">Organization Name</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Green Springs School"
                                    required
                                    value={activateForm.name}
                                    onChange={e => setActivateForm({...activateForm, name: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-1">Organization Type</label>
                                <select 
                                    className="form-control"
                                    value={activateForm.type}
                                    onChange={e => setActivateForm({...activateForm, type: e.target.value})}
                                >
                                    <option>School</option>
                                    <option>NGO</option>
                                    <option>Company</option>
                                    <option>Government</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-1">Address (Optional)</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Office location"
                                    value={activateForm.address}
                                    onChange={e => setActivateForm({...activateForm, address: e.target.value})}
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isActivating}
                                className="w-full bg-brand text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 mt-4"
                            >
                                {isActivating ? 'Setting Up...' : 'Enable Free Tools'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // --- DASHBOARD VIEW ---
    return (
        <div className="container mx-auto px-4 py-8 animate-view">
            <SEO title={`Procurement Dashboard - ${institution.org_name}`} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <ArrowLeft className="" />
                        {institution.org_name}
                    </h1>
                    <p className="text-slate-500 text-sm">Procurement Dashboard â€¢ {institution.org_type}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onNavigateHome} className="px-4 py-2 border rounded-lg text-slate-600 text-sm font-bold hover:bg-slate-50">
                        Back to Market
                    </button>
                    <button onClick={handleExport} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 flex items-center gap-2">
                        <ArrowLeft className="" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Planned Budget</div>
                    <div className="text-2xl font-black text-amber-500">â‚¦{totalPlanned.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-2">{logs.filter(l => l.status === 'planned').length} items pending</div>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Spent</div>
                    <div className="text-2xl font-black text-emerald-600">â‚¦{totalSpent.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-2">{logs.filter(l => l.status === 'purchased').length} items purchased</div>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Items</div>
                    <div className="text-2xl font-black text-slate-900">{logs.length}</div>
                    <div className="text-xs text-slate-400 mt-2">Across all lists</div>
                </div>
            </div>

            {/* Procurement List */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-slate-800">Procurement Log</h2>
                    <button onClick={() => setIsAddOpen(!isAddOpen)} className="text-brand text-sm font-bold hover:underline">
                        + Add Manual Item
                    </button>
                </div>

                {isAddOpen && (
                    <form onSubmit={handleManualAdd} className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-3 items-end animate-view">
                        <div className="flex-1 w-full">
                            <label className="text-xs font-bold text-slate-500">Item Name</label>
                            <input type="text" className="form-control h-10" required placeholder="e.g. Office Chairs" 
                                value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                        </div>
                        <div className="w-full md:w-32">
                             <label className="text-xs font-bold text-slate-500">Qty</label>
                             <input type="number" className="form-control h-10" required min="1" 
                                value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} />
                        </div>
                        <div className="w-full md:w-40">
                             <label className="text-xs font-bold text-slate-500">Unit Price (â‚¦)</label>
                             <input type="number" className="form-control h-10" required 
                                value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                        </div>
                        <button type="submit" className="bg-brand text-white px-6 h-10 rounded-lg font-bold text-sm w-full md:w-auto">Add</button>
                    </form>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-3">Item</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Qty</th>
                                <th className="px-6 py-3 text-right">Unit Price</th>
                                <th className="px-6 py-3 text-right">Total</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No items in your procurement log.</td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{log.products?.title || log.custom_item_name}</div>
                                            <div className="text-xs text-slate-500">{new Date(log.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.status === 'purchased' ? (
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold border border-emerald-200">Purchased</span>
                                            ) : (
                                                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200">Planned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">{log.quantity}</td>
                                        <td className="px-6 py-4 text-right">â‚¦{log.unit_price.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-bold">â‚¦{(log.quantity * log.unit_price).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {log.status === 'planned' && (
                                                    <button onClick={() => markAsPurchased(log.id)} title="Mark as Purchased" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded">
                                                        <ArrowLeft className="" />
                                                    </button>
                                                )}
                                                <button onClick={() => deleteLog(log.id)} title="Remove" className="p-2 text-red-500 hover:bg-red-50 rounded">
                                                    <ArrowLeft className="" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}



