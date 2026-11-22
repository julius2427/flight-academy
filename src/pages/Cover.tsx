import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { CATEGORIES } from '../lib/constants'
import { demoEnabled } from './Demo'

const CONDUCT: { title: string; points: string[] }[] = [
  { title: 'Respect for Others', points: [
    'Treat all participants, coaches, staff, and parents with respect and courtesy, regardless of race, gender, ability, or background.',
    'Bullying, harassment, or any form of discrimination will not be tolerated.',
    'Respect all property, facilities, and equipment provided by the training center and others.' ] },
  { title: 'Behavior Expectations', points: [
    'Follow all instructions given by coaches, trainers, and staff promptly and respectfully.',
    'Maintain a positive attitude and display good sportsmanship at all times, both in training and competition.',
    'Profanity, rude gestures, and disrespectful behavior are prohibited.' ] },
  { title: 'Commitment and Participation', points: [
    'Arrive on time and be prepared for all training sessions, practices, and events.',
    'Participants are expected to give their best effort during all activities, maintaining focus and dedication to improving skills.',
    'Attendance at scheduled practices and events is required unless previously excused.' ] },
  { title: 'Safety', points: [
    'Follow all safety rules and guidelines provided by coaches and staff.',
    'Report any injuries or unsafe conditions to staff immediately.',
    'Use equipment and facilities appropriately to avoid accidents or damage.' ] },
  { title: 'Dress Code', points: [
    'Wear appropriate athletic attire, including proper footwear, during all activities.',
    'Jewelry, accessories, or items that may pose a safety risk must be removed during practice and games.' ] },
  { title: 'Parental Conduct', points: [
    'Parents and guardians are encouraged to support their child in a positive and respectful manner.',
    'Refrain from coaching or instructing during training sessions unless explicitly invited by the coaching staff.',
    'Demonstrate sportsmanship when attending events by respecting all officials, coaches, and other parents.' ] },
  { title: 'Substance Abuse', points: [
    'The use of drugs, alcohol, or tobacco products is strictly prohibited for all participants.',
    'Participants found using or under the influence of any banned substances will face disciplinary action, including possible removal from the program.' ] },
  { title: 'Discipline and Consequences', points: [
    'Failure to adhere to this Code of Conduct will result in disciplinary actions, which may include verbal warnings, suspension from activities, or expulsion from the center.',
    'Serious offenses, such as violence, harassment, or substance abuse, may lead to immediate dismissal without refund.' ] },
  { title: 'Grievance Procedure', points: [
    'Any concerns or grievances should be addressed respectfully and through appropriate channels, starting with a coach or staff member.',
    'If unresolved, formal complaints may be submitted in writing to the center’s management team.' ] },
]

export default function Cover() {
  const { session } = useAuth()
  const portal = session ? '/app' : '/login'
  return (
    <>
      <div className="cover-nav">
        <div className="container">
          {demoEnabled && !session && <Link to="/demo" className="btn btn-sm">View the demo</Link>}
          <Link to={portal} className="btn btn-sm">{session ? 'Open dashboard' : 'Coach login'}</Link>
        </div>
      </div>

      <header className="hero">
        <div className="container">
          <img className="hero-logo" src="./logo.png" alt="Flight Academy logo" width={260} height={296} />
          <div>
            <div className="eyebrow" style={{ color: '#b9cdff' }}>Fairborn Flight Academy</div>
            <h1>Flight Academy</h1>
            <div className="tagline">Forward…Fast</div>
            <p>
              Inspiring and empowering young athletes to reach their full potential through
              high-quality training, discipline, respect, and sportsmanship.
            </p>
            <div className="row">
              {demoEnabled && <Link to="/demo" className="btn btn-primary">View the demo</Link>}
              <Link to={portal} className={demoEnabled ? 'btn btn-outline' : 'btn btn-primary'}>Coach portal</Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section section-alt" id="mission">
        <div className="container">
          <div className="eyebrow">Mission statement</div>
          <h2>Building more than athletes</h2>
          <p className="lede">
            At the Fairborn Flight Academy, our mission is to inspire and empower young athletes to reach their
            full potential by providing a safe, supportive, and inclusive environment. We are dedicated to fostering
            personal growth, teamwork, and a passion for sports through high-quality training programs, emphasizing
            discipline, respect, and sportsmanship.
          </p>
          <p className="lede" style={{ marginBottom: 0 }}>
            Our goal is to help youth athletes build not only physical skills but also confidence, resilience, and a
            lifelong love for healthy competition and active living.
          </p>
        </div>
      </section>


      <section className="section" id="development">
        <div className="container">
          <div className="eyebrow">Development categories</div>
          <h2>Seven measurable areas</h2>
          <p className="lede">
            Every drill and exercise is tied to the areas it develops, so each athlete’s progress is
            tracked where it matters: overall performance, injury prevention, and reaching goals.
          </p>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <div className="cat-card" key={c.id}>
                <span className="cat-num">{c.id}</span>
                <h3>{c.name}</h3>
                <p>{c.examples}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="conduct">
        <div className="container">
          <div className="eyebrow">Code of conduct</div>
          <h2>How we compete</h2>
          <p className="lede">
            A safe, respectful, and positive environment for all participants, staff, coaches, and families.
          </p>
          <div className="conduct">
            {CONDUCT.map((c, i) => (
              <details key={c.title}>
                <summary><span className="cat-num">{i + 1}</span>{c.title}</summary>
                <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
              </details>
            ))}
          </div>
          <p className="muted" style={{ marginTop: '1.25rem' }}>
            <strong>Acknowledgment.</strong> By participating in the Flight Academy, athletes and their guardians agree to
            abide by this Code of Conduct. Repeated or serious violations may result in disciplinary action, up to and
            including dismissal from the program.
          </p>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span>© {new Date().getFullYear()} Fairborn Flight Academy · Forward…Fast</span>
          <Link to={portal}>Coach portal →</Link>
        </div>
      </footer>
    </>
  )
}
