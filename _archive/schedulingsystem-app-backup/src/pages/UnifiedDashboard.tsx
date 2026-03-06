import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, where, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { COLLECTIONS } from "../collections";
import { ServiceJob, InventoryItem, Client, Property } from "../../types";
import {
  ArrowLeft, Package, Briefcase, Users, Home, TrendingUp,
  DollarSign, BarChart3, ExternalLink, ArrowRight, Clock,
  CheckCircle2, AlertCircle, Loader2
} from "lucide-react";

const UnifiedDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [serviceJobs, setServiceJobs] = useState<ServiceJob[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'jobs' | 'inventory'>('overview');

  // Fetch all data
  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    try {
      // Service Jobs
      const jobsQuery = query(
        collection(db, COLLECTIONS.JOBS),
        orderBy("scheduledDate", "desc"),
        limit(20)
      );
      const unsubJobs = onSnapshot(jobsQuery, (snapshot) => {
        const jobs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<ServiceJob, "id">)
        }));
        setServiceJobs(jobs);
      }, (err) => {
        console.error("Jobs subscription error:", err);
        setError(err.message);
      });
      unsubscribers.push(unsubJobs);

      // Inventory
      const inventoryQuery = query(
        collection(db, "inventory"),
        orderBy("lastUpdated", "desc"),
        limit(20)
      );
      const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<InventoryItem, "id">)
        }));
        setInventory(items);
      }, (err) => {
        console.error("Inventory subscription error:", err);
      });
      unsubscribers.push(unsubInventory);

      // Clients
      const clientsQuery = query(collection(db, "clients"));
      const unsubClients = onSnapshot(clientsQuery, (snapshot) => {
        const clientsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Client, "id">)
        }));
        setClients(clientsList);
      }, (err) => {
        console.error("Clients subscription error:", err);
      });
      unsubscribers.push(unsubClients);

      // Properties
      const propertiesQuery = query(collection(db, "properties"));
      const unsubProperties = onSnapshot(propertiesQuery, (snapshot) => {
        const propertiesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Property, "id">)
        }));
        setProperties(propertiesList);
        setLoading(false);
      }, (err) => {
        console.error("Properties subscription error:", err);
        setLoading(false);
      });
      unsubscribers.push(unsubProperties);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data.";
      setError(message);
      setLoading(false);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Calculate metrics
  const totalRevenue = clients.reduce((sum, client) => sum + (client.stats?.totalRevenue || 0), 0);
  const activeInventoryValue = inventory
    .filter(item => item.status === 'Active')
    .reduce((sum, item) => sum + parseFloat(item.price || '0'), 0);
  const completedJobs = serviceJobs.filter(job => job.status === 'COMPLETED').length;
  const pendingJobs = serviceJobs.filter(job => job.status === 'REVIEW_PENDING').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-blue-600 animate-spin mx-auto mb-2" />
          <div className="text-sm text-slate-500">Loading unified dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-md mx-auto mt-10 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4">
          <AlertCircle size={20} className="inline mr-2" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 page-enter">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-200 rounded-full"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Unified Dashboard</h1>
              <p className="text-sm text-slate-500">Phase X: Complete business overview</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={import.meta.env.VITE_SCHEDULING_APP_URL || "https://your-scheduling-app.vercel.app"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
            >
              <Briefcase size={16} />
              Scheduling App
              <ExternalLink size={14} />
            </a>
            <a
              href={import.meta.env.VITE_RESALE_APP_URL || "https://your-resale-app.vercel.app"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700"
            >
              <Package size={16} />
              Resale App
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Top-Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Clients"
            value={clients.length}
            icon={<Users className="text-blue-500" />}
            subtitle={`${properties.length} properties`}
          />
          <MetricCard
            title="Service Jobs"
            value={serviceJobs.length}
            icon={<Briefcase className="text-purple-500" />}
            subtitle={`${pendingJobs} pending review`}
            highlight={pendingJobs > 0}
          />
          <MetricCard
            title="Active Inventory"
            value={inventory.filter(i => i.status === 'Active').length}
            icon={<Package className="text-emerald-500" />}
            subtitle={`$${activeInventoryValue.toFixed(0)} value`}
          />
          <MetricCard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="text-amber-500" />}
            subtitle="All-time sales"
          />
        </div>

        {/* View Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
          <button
            onClick={() => setActiveView('overview')}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeView === 'overview'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 size={16} className="inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveView('jobs')}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeView === 'jobs'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Briefcase size={16} className="inline mr-2" />
            Service Jobs
          </button>
          <button
            onClick={() => setActiveView('inventory')}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeView === 'inventory'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package size={16} className="inline mr-2" />
            Inventory Items
          </button>
        </div>

        {/* Overview View */}
        {activeView === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Service Jobs */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b px-4 py-3 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Recent Service Jobs</h3>
                <button
                  onClick={() => setActiveView('jobs')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  View All <ArrowRight size={12} className="inline" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {serviceJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="p-4 hover:bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-slate-800">{job.clientName}</div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        job.status === 'REVIEW_PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{job.address}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(job.date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Inventory */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b px-4 py-3 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Recent Inventory</h3>
                <button
                  onClick={() => setActiveView('inventory')}
                  className="text-xs text-emerald-600 font-semibold hover:underline"
                >
                  View All <ArrowRight size={12} className="inline" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {inventory.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 text-sm">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.platform}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">${item.price}</div>
                      <div className="text-xs text-slate-400">{item.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Jobs View */}
        {activeView === 'jobs' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Pay</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{job.clientName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{job.address}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(job.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-emerald-600">${job.pay}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        job.status === 'REVIEW_PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Inventory View */}
        {activeView === 'inventory' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.platform}</td>
                    <td className="px-4 py-3 text-sm font-bold text-emerald-600">${item.price}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                        item.status === 'Running' ? 'bg-blue-100 text-blue-700' :
                        item.status === 'Error' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.clientName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  highlight?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, subtitle, highlight }) => {
  return (
    <div className={`bg-white rounded-xl border p-6 ${
      highlight ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</div>
        {icon}
      </div>
      <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
      {subtitle && (
        <div className="text-xs text-slate-500">{subtitle}</div>
      )}
    </div>
  );
};

export default UnifiedDashboard;
