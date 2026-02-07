export function PlatformSection() {
  return (
    <section id="platform" className="py-32 border-t border-[#2F343C]/40">
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-6">
          Platform
        </p>

        <h2
          className="text-[#F6F7F9] font-semibold leading-[1.08] tracking-tight max-w-[700px]"
          style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.025em' }}
        >
          Data in. Decisions out.
        </h2>

        <p className="text-[#8F99A8] text-base leading-relaxed max-w-[600px] mt-6">
          BigDunc operates as a three-stage pipeline. Raw sensor data flows through
          ingestor modules, is processed by algorithm engines, and surfaces as
          actionable intelligence your coaching staff can use immediately.
        </p>

        {/* Three stages */}
        <div className="grid md:grid-cols-3 gap-px mt-20 bg-[#2F343C]/40">
          {[
            {
              num: '01',
              title: 'Ingest',
              body: 'Four ingestor modules connect to GPS hardware, wearable devices, and performance APIs. Catapult Vector at 10Hz GPS and 100Hz IMU. Premier League squad data. Football-Data.org, API-Football, Understat, and FBref integration. Wearable analytics with speed zone classification and heart rate analysis.',
            },
            {
              num: '02',
              title: 'Analyze',
              body: 'Six purpose-built algorithm modules process ingested data. Q-Learning tactical AI with Monte Carlo simulation. Markov chain pattern recognition across 40+ tactical patterns. Boid-based multi-agent positioning with genetic algorithm evolution. Graph-theory passing networks with eigenvector centrality. Coherence scoring. Digital twin modeling.',
            },
            {
              num: '03',
              title: 'Decide',
              body: 'Actionable output surfaces in real-time. Formation change recommendations with expected impact on possession and xG. Pressing intensity optimization. Substitution timing based on fatigue trajectories and tactical need. Critical deviation alerts with auto-generated recommendations.',
            },
          ].map((stage) => (
            <div key={stage.num} className="bg-[#111418] p-10">
              <span className="text-[13px] text-[#5F6B7C] font-mono">{stage.num}</span>
              <h3 className="text-[#F6F7F9] text-xl font-semibold mt-3 mb-4">{stage.title}</h3>
              <p className="text-[#8F99A8] text-sm leading-relaxed">{stage.body}</p>
            </div>
          ))}
        </div>

        {/* Bottom statement */}
        <div className="mt-20 border-t border-[#2F343C]/40 pt-10">
          <p className="text-[#8F99A8] text-base leading-relaxed max-w-[600px]">
            There is no charge for getting your data into the platform or for getting it out.
            BigDunc works with your existing Catapult, STATSports, or GPS hardware. No data
            science team required. Premier League to grassroots — it scales to any level.
          </p>
        </div>
      </div>
    </section>
  );
}
