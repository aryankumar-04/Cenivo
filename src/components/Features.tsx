import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, MessageCircle, Eye, FolderHeart } from 'lucide-react';

export default function Features() {
  const cards = [
    {
      icon: <Sparkles className="w-5 h-5 text-white" />,
      title: "Ai Discovery Engine",
      desc: "Get incredibly accurate suggestions curated dynamically by Gemini. Describe any mood, scenario or theme and watch Cenivo map your next favorite choice.",
      gradient: "hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
    },
    {
      icon: <MessageCircle className="w-5 h-5 text-zinc-300" />,
      title: "Rate & Review",
      desc: "Connect your taste profiles instantly. Rate movies, Series, or Anime choices on our custom Criticker rating sheets and share micro critic insights.",
      gradient: "hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
    },
    {
      icon: <Eye className="w-5 h-5 text-zinc-300" />,
      title: "Watch Journal",
      desc: "Track everything you watch with your private Watch Journal. Watch status updates transition dynamically across Watchlist, Watching, and Completed.",
      gradient: "hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
    },
    {
      icon: <FolderHeart className="w-5 h-5 text-white" />,
      title: "Personal Playlists",
      desc: "Create bespoke visual collections, sort by genre, runtime, or directors. Highlight critic picks and editor's choice lists together with friends.",
      gradient: "hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
    }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#050505] relative overflow-hidden">
      {/* Background glow positioning */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((item, index) => (
            <motion.div
              key={index}
              className={`p-8 bg-[#111111]/60 border border-white/5 rounded-2xl flex flex-col items-start text-left gap-4 backdrop-blur-sm transition-all duration-300 ${item.gradient}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <div className="flex items-center justify-center p-3 rounded-lg bg-[#111111] border border-white/10 shadow-sm leading-none">
                {item.icon}
              </div>
              <h3 className="font-sans font-bold text-lg text-white tracking-tight pt-2">
                {item.title}
              </h3>
              <p className="font-sans text-sm text-[#A1A1AA] leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
