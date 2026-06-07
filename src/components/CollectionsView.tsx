import React from 'react';
import { motion } from 'motion/react';
import { PREMIUM_COLLECTIONS } from '../data';
import { Heart } from 'lucide-react';

interface CollectionsViewProps {
  onStartCollection: () => void;
  collections?: any[];
}

export default function CollectionsView({ onStartCollection, collections }: CollectionsViewProps) {
  // Use real dynamic collections if available, else static
  const listCollections = collections && collections.length > 0 ? collections : PREMIUM_COLLECTIONS;

  // Overlapping stats
  const stats = [
    { value: "500K+", label: "Recommendations Map", delay: 0.1 },
    { value: "120K+", label: "Registered Cinephiles", delay: 0.2 },
    { value: "2.4M+", label: "Reviews & Ratings Explored", delay: 0.3 }
  ];

  return (
    <section id="collections" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#050505] relative overflow-hidden">
      {/* Background glow overlay */}
      <div className="absolute top-[40%] left-[-15%] w-[400px] h-[400px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full space-y-24 relative z-10">
        
        {/* Top: Collections Overlap Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Side: Context Narrative */}
          <div className="space-y-8 text-left max-w-xl order-2 lg:order-1">
            <h2 className="font-sans font-extrabold text-4xl sm:text-5xl text-white tracking-tight leading-tight">
              Track your history and create<br />
              <span className="text-zinc-300">unlimited collections.</span>
            </h2>

            <p className="font-sans text-zinc-400 text-base sm:text-lg leading-relaxed">
              Cenivo organizes your watchlist, streaming history, and favorites into beautifully cataloged digital drawers. Track what you've seen, what's currently active on your queue, and browse other users' niche curated topics.
            </p>

            <ul className="space-y-4 pt-2">
              {[
                "Keep a clean Watchlist for upcoming movie nights with friends",
                "Log your active watching progress and rate sessions instantly",
                "Browse public lists crafted by collectors with similar profiles",
                "Build locked private collections or collaborate directly on shared ones"
              ].map((text, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="flex items-center justify-center mt-1 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                    <Heart className="w-3.5 h-3.5 text-zinc-300" />
                  </div>
                  <span className="font-sans text-sm sm:text-base text-zinc-300">{text}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4">
              <button
                onClick={onStartCollection}
                className="px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl border border-white/10 transition-all cursor-pointer shadow-lg"
              >
                Start a collection
              </button>
            </div>
          </div>

          {/* Right Side: Visual Overlapping Deck Posters */}
          <div className="relative w-full h-[380px] flex items-center justify-center lg:justify-end order-1 lg:order-2">
            <div className="relative w-full max-w-[400px] h-[320px]">
              {listCollections.slice(0, 3).map((col, index) => {
                let offset = index === 0 ? "top-0 right-12 z-25" : index === 1 ? "top-16 right-0 z-20" : "top-28 right-20 z-10 scale-95";

                return (
                  <motion.div
                    key={index}
                    className={`absolute p-4 w-[280px] bg-[#111111] border border-white/5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] ${offset} group cursor-pointer`}
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    whileHover={{
                      scale: 1.05,
                      y: -10,
                      borderColor: "rgba(255,255,255,0.2)",
                      boxShadow: "0 25px 45px rgba(255,255,255,0.05)",
                      zIndex: 30
                    }}
                  >
                    <div className="relative w-full h-32 rounded-xl overflow-hidden">
                      <img
                        src={col.image}
                        alt={col.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono border border-white/10 text-zinc-300">
                        ★ {col.rating} rating
                      </div>
                    </div>

                    <div className="pt-4 text-left">
                      <h4 className="font-sans font-bold text-lg text-white leading-tight truncate" title={col.title}>
                        {col.title}
                      </h4>
                      <p className="text-zinc-400 font-sans text-xs pt-1 line-clamp-1 leading-tight">{col.blurb}</p>
                      <div className="flex items-center gap-2 pt-2.5 text-[11px] font-mono text-zinc-400">
                        <span>{col.titles}</span>
                        <span className="text-white/25">•</span>
                        <span>{col.rated}</span>
                      </div>
                      <div className="pt-3 flex items-center justify-between text-[11px] text-white/50 border-t border-white/5 mt-3">
                        <span>By @{col.user}</span>
                        <span className="text-white group-hover:underline font-semibold">View Deck →</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Bottom: Animated Counters / Statistics Grid */}
        <div className="pt-16 border-t border-white/5 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {stats.map((st, idx) => (
              <motion.div
                key={idx}
                className="p-8 bg-[#111111]/40 border border-white/5 rounded-2xl text-center flex flex-col items-center justify-center gap-2"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: st.delay }}
              >
                <span className="font-sans font-extrabold text-white text-4.5xl sm:text-5xl md:text-5xl tracking-tight leading-none">
                  {st.value}
                </span>
                <span className="font-sans text-xs text-zinc-400 tracking-wide uppercase font-medium">
                  {st.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
