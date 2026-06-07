import React from 'react';
import { motion } from 'motion/react';
import { SHOWCASE_RECOMMENDATIONS } from '../data';
import { Check, Sparkles } from 'lucide-react';

interface ShowcaseProps {
  onStartDiscovering: () => void;
  onSelectMovie?: (movie: any) => void;
}

export default function Showcase({ 
  onStartDiscovering,
  onSelectMovie
}: ShowcaseProps) {
  // Use static list
  const listItems = SHOWCASE_RECOMMENDATIONS;

  return (
    <section id="recommendations" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0B0B0B] relative overflow-hidden">
      
      {/* Background glow overlay */}
      <div className="absolute top-[30%] right-[-10%] w-[450px] h-[450px] rounded-full bg-white/5 blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        
        {/* Left Side (Cascading Offset Rating Cards Stack) */}
        <div className="relative w-full h-[520px] flex items-center justify-center lg:justify-start">
          <div className="relative w-[340px] h-[440px]">
            {listItems.map((item, index) => {
              // Calculate custom rating outline color/badge style
              let ratingColor = "bg-zinc-900 border-white/20 text-white font-bold";
              if (item.rating >= 90) ratingColor = "bg-white text-black border-white font-bold";
              else if (item.rating >= 70) ratingColor = "bg-zinc-800 text-zinc-200 border-white/10 font-semibold";

              return (
                <motion.div
                  key={index}
                  onClick={() => {
                    if (onSelectMovie && (item as any).rawMovie) {
                      onSelectMovie((item as any).rawMovie);
                    } else {
                      onStartDiscovering();
                    }
                  }}
                  className="absolute left-0 w-full p-4 bg-[#111111] border border-white/5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4 cursor-pointer"
                  style={{
                    top: `${index * 65}px`,
                    zIndex: listItems.length - index,
                    transform: `scale(${1 - index * 0.035})`
                  }}
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.06 }}
                  whileHover={{
                    scale: 1.03,
                    x: 10,
                    borderColor: 'rgba(255,255,255,0.2)',
                    boxShadow: '0 20px 40px rgba(255,255,255,0.05)',
                    transition: { duration: 0.2 }
                  }}
                >
                  {/* Left: Indicator, Title, Platform */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-sans font-extrabold text-white text-base leading-tight tracking-tight text-left truncate">
                        {item.title}
                      </h4>
                      <p className="font-sans text-xs text-zinc-400 leading-none pt-1 text-left">
                        Available on {item.platform}
                      </p>
                    </div>
                  </div>

                  {/* Right: Round Rating Badge */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-sans tracking-tight border shrink-0 ${ratingColor}`}>
                    {item.rating}%
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right Side (Context & Value Narrative) */}
        <div className="space-y-8 text-left max-w-xl">
          <h2 className="font-sans font-extrabold text-4xl sm:text-5xl text-white tracking-tight leading-tight">
            Explore your personalized<br />
            <span className="text-zinc-300">movie and TV picks.</span>
          </h2>

          <p className="font-sans text-zinc-400 text-base sm:text-lg leading-relaxed">
            Cenivo’s algorithm couples deep Gemini intelligence with public TMDB metadata to map your taste footprint against millions of titles. It crafts incredibly accurate predictions representing exactly how likely you are to love a film, series, or anime before hitting play.
          </p>

          <ul className="space-y-4 pt-2">
            {[
              "Generate smart predictions after rating just ten titles",
              "Discover alternative titles from users who share your exact layout",
              "Instantly categorize watch status with full structural transparency",
              "Leverage Gemini's reasoning to dissect complex themes instantly"
            ].map((text, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="flex items-center justify-center mt-1 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-sans text-sm sm:text-base text-zinc-300">{text}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4">
            <button
              onClick={onStartDiscovering}
              className="px-8 py-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-black" />
              <span>Start Discovering</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
