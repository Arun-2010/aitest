import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const COLORS = ["#4f46e5", "#22c55e", "#ef4444", "#f59e0b"];

export default function App() {
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchEmails();
    fetchStats();
  }, []);

  const fetchEmails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/emails`);
      // Ensure sentiment & priority are extracted properly
      const formattedEmails = res.data.map((email) => ({
        ...email,
        sentiment:
          typeof email.sentiment === "object"
            ? email.sentiment.label
            : email.sentiment,
        priority:
          typeof email.priority === "object"
            ? email.priority.label
            : email.priority,
        reply: email.reply || "", // ensure reply is initialized
      }));
      setEmails(formattedEmails);
    } catch (err) {
      console.error("Error fetching emails:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleRespond = async (id, reply) => {
    try {
      await axios.post(`${API_BASE}/api/respond/${id}`, { reply });
      fetchEmails();
      fetchStats();
    } catch (err) {
      console.error("Error sending reply:", err);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-indigo-700 mb-6">
        AI Support Assistant
      </h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded-xl p-4 text-center">
          <h2 className="text-lg font-semibold">Total Emails</h2>
          <p className="text-2xl font-bold text-indigo-600">
            {stats.total || 0}
          </p>
        </div>
        <div className="bg-white shadow rounded-xl p-4 text-center">
          <h2 className="text-lg font-semibold">Resolved</h2>
          <p className="text-2xl font-bold text-green-600">
            {stats.resolved || 0}
          </p>
        </div>
        <div className="bg-white shadow rounded-xl p-4 text-center">
          <h2 className="text-lg font-semibold">Pending</h2>
          <p className="text-2xl font-bold text-red-500">
            {stats.pending || 0}
          </p>
        </div>
        <div className="bg-white shadow rounded-xl p-4 text-center">
          <h2 className="text-lg font-semibold">Urgent</h2>
          <p className="text-2xl font-bold text-yellow-500">
            {stats.urgent || 0}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-4">Sentiment Distribution</h3>
          <PieChart width={350} height={250}>
            <Pie
              data={stats.sentiment || []}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {stats.sentiment &&
                stats.sentiment.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </div>

        <div className="bg-white shadow rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-4">Priority Distribution</h3>
          <BarChart
            width={400}
            height={250}
            data={stats.priority || []}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#4f46e5" />
          </BarChart>
        </div>
      </div>

      {/* Emails Table */}
      <div className="bg-white shadow rounded-xl p-4">
        <h3 className="text-xl font-semibold mb-4">Incoming Emails</h3>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-indigo-100 text-gray-800">
                <th className="p-3 text-left">From</th>
                <th className="p-3 text-left">Subject</th>
                <th className="p-3 text-left">Priority</th>
                <th className="p-3 text-left">Sentiment</th>
                <th className="p-3 text-left">AI Draft Reply</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{email.from}</td>
                  <td className="p-3">{email.subject}</td>
                  <td
                    className={`p-3 font-semibold ${
                      email.priority === "urgent"
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {email.priority || "normal"}
                  </td>
                  <td
                    className={`p-3 font-semibold ${
                      email.sentiment === "negative"
                        ? "text-red-500"
                        : email.sentiment === "positive"
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {email.sentiment || "neutral"}
                  </td>
                  <td className="p-3">
                    <textarea
                      className="border rounded-lg w-full p-2 text-sm"
                      value={email.reply}
                      onChange={(e) =>
                        setEmails((prev) =>
                          prev.map((el) =>
                            el.id === email.id
                              ? { ...el, reply: e.target.value }
                              : el
                          )
                        )
                      }
                    />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                      onClick={() => handleRespond(email.id, email.reply)}
                    >
                      Send
                    </button>
                  </td>
                </tr>
              ))}
              {emails.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center p-4 text-gray-500">
                    No emails found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
