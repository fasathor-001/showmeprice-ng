import React from "react";

export default function NotificationsPage() {
  return (
    <div className="space-y-3">
      <div className="font-black text-slate-900 text-lg">Notifications</div>
      <div className="text-sm text-slate-600">
        Alerts and updates will appear here. (Next: connect to a notifications table or realtime events.)
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-700">
        <div className="font-black">No notifications yet</div>
        <div className="text-sm mt-1">You’ll get notified about messages, deals and updates.</div>
      </div>
    </div>
  );
}
