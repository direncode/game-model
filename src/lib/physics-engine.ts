/**
 * PHYSICS ENGINE
 * Hyper-realistic ball and player movement simulation
 * Includes biomechanics, environmental factors, and collision dynamics
 */

// ============================================================================
// VECTOR MATHEMATICS
// ============================================================================

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D extends Vector2D {
  z: number;
}

export const Vector = {
  add: (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x + b.x, y: a.y + b.y }),
  subtract: (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x - b.x, y: a.y - b.y }),
  multiply: (v: Vector2D, scalar: number): Vector2D => ({ x: v.x * scalar, y: v.y * scalar }),
  magnitude: (v: Vector2D): number => Math.sqrt(v.x * v.x + v.y * v.y),
  normalize: (v: Vector2D): Vector2D => {
    const mag = Vector.magnitude(v);
    return mag > 0 ? { x: v.x / mag, y: v.y / mag } : { x: 0, y: 0 };
  },
  dot: (a: Vector2D, b: Vector2D): number => a.x * b.x + a.y * b.y,
  distance: (a: Vector2D, b: Vector2D): number => Vector.magnitude(Vector.subtract(a, b)),
  angle: (v: Vector2D): number => Math.atan2(v.y, v.x),
  fromAngle: (angle: number, magnitude: number = 1): Vector2D => ({
    x: Math.cos(angle) * magnitude,
    y: Math.sin(angle) * magnitude
  }),
  rotate: (v: Vector2D, angle: number): Vector2D => ({
    x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
    y: v.x * Math.sin(angle) + v.y * Math.cos(angle)
  }),
  lerp: (a: Vector2D, b: Vector2D, t: number): Vector2D => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  })
};

// ============================================================================
// BALL PHYSICS
// ============================================================================

export interface BallState {
  position: Vector3D;
  velocity: Vector3D;
  angularVelocity: Vector3D;  // Spin in rad/s
  inAir: boolean;
  lastTouch: string | null;   // Player ID
}

export interface BallPhysicsConfig {
  mass: number;               // kg (standard ball: 0.43)
  radius: number;             // m (standard: 0.11)
  dragCoefficient: number;    // Air resistance
  magnusCoefficient: number;  // Spin effect
  rollingFriction: number;    // Ground friction
  bounciness: number;         // Coefficient of restitution
}

const DEFAULT_BALL_CONFIG: BallPhysicsConfig = {
  mass: 0.43,
  radius: 0.11,
  dragCoefficient: 0.25,
  magnusCoefficient: 0.15,
  rollingFriction: 0.015,
  bounciness: 0.7
};

export interface EnvironmentalConditions {
  windSpeed: number;          // m/s
  windDirection: number;      // radians
  temperature: number;        // Celsius
  humidity: number;           // 0-100%
  altitude: number;           // meters above sea level
  pitchCondition: 'dry' | 'wet' | 'muddy' | 'frozen' | 'artificial';
  grassLength: number;        // mm
}

export class BallPhysics {
  private config: BallPhysicsConfig;
  private state: BallState;
  private environment: EnvironmentalConditions;
  private readonly GRAVITY = 9.81;
  private readonly AIR_DENSITY_BASE = 1.225;  // kg/m³ at sea level

  constructor(
    config: Partial<BallPhysicsConfig> = {},
    environment: Partial<EnvironmentalConditions> = {}
  ) {
    this.config = { ...DEFAULT_BALL_CONFIG, ...config };
    this.environment = {
      windSpeed: 0,
      windDirection: 0,
      temperature: 20,
      humidity: 50,
      altitude: 0,
      pitchCondition: 'dry',
      grassLength: 25,
      ...environment
    };
    this.state = {
      position: { x: 52.5, y: 34, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      inAir: false,
      lastTouch: null
    };
  }

  private getAirDensity(): number {
    // Adjust for altitude and temperature
    const altitudeFactor = Math.exp(-this.environment.altitude / 8500);
    const tempFactor = 293 / (273 + this.environment.temperature);
    return this.AIR_DENSITY_BASE * altitudeFactor * tempFactor;
  }

  private calculateDragForce(): Vector3D {
    const speed = Math.sqrt(
      this.state.velocity.x ** 2 +
      this.state.velocity.y ** 2 +
      this.state.velocity.z ** 2
    );

    if (speed < 0.01) return { x: 0, y: 0, z: 0 };

    const airDensity = this.getAirDensity();
    const area = Math.PI * this.config.radius ** 2;
    const dragMagnitude = 0.5 * this.config.dragCoefficient * airDensity * area * speed ** 2;

    return {
      x: -dragMagnitude * (this.state.velocity.x / speed),
      y: -dragMagnitude * (this.state.velocity.y / speed),
      z: -dragMagnitude * (this.state.velocity.z / speed)
    };
  }

  private calculateMagnusForce(): Vector3D {
    // Magnus effect from ball spin
    const speed = Math.sqrt(
      this.state.velocity.x ** 2 +
      this.state.velocity.y ** 2 +
      this.state.velocity.z ** 2
    );

    if (speed < 1) return { x: 0, y: 0, z: 0 };

    const airDensity = this.getAirDensity();
    const spinMagnitude = Math.sqrt(
      this.state.angularVelocity.x ** 2 +
      this.state.angularVelocity.y ** 2 +
      this.state.angularVelocity.z ** 2
    );

    // Simplified Magnus: F = Cl * ρ * A * v * ω * r
    const magnusMagnitude = this.config.magnusCoefficient * airDensity *
      Math.PI * this.config.radius ** 2 * speed * spinMagnitude * this.config.radius;

    // Cross product of angular velocity and linear velocity
    return {
      x: magnusMagnitude * (this.state.angularVelocity.y * this.state.velocity.z -
                           this.state.angularVelocity.z * this.state.velocity.y) / (speed * spinMagnitude + 0.001),
      y: magnusMagnitude * (this.state.angularVelocity.z * this.state.velocity.x -
                           this.state.angularVelocity.x * this.state.velocity.z) / (speed * spinMagnitude + 0.001),
      z: magnusMagnitude * (this.state.angularVelocity.x * this.state.velocity.y -
                           this.state.angularVelocity.y * this.state.velocity.x) / (speed * spinMagnitude + 0.001)
    };
  }

  private calculateWindForce(): Vector3D {
    if (this.environment.windSpeed < 0.1) return { x: 0, y: 0, z: 0 };

    const airDensity = this.getAirDensity();
    const area = Math.PI * this.config.radius ** 2;
    const windForce = 0.5 * airDensity * area * this.environment.windSpeed ** 2;

    // Wind affects ball more when in air
    const heightFactor = this.state.inAir ? 1.5 : 0.3;

    return {
      x: Math.cos(this.environment.windDirection) * windForce * heightFactor,
      y: Math.sin(this.environment.windDirection) * windForce * heightFactor,
      z: 0
    };
  }

  private getRollingFriction(): number {
    const baseFriction = this.config.rollingFriction;

    // Adjust for pitch conditions
    const conditionFactors: Record<string, number> = {
      'dry': 1.0,
      'wet': 0.7,      // Less friction, ball travels faster
      'muddy': 1.8,    // More friction, ball slows down
      'frozen': 0.5,   // Very slippery
      'artificial': 0.85
    };

    const grassFactor = 1 + (this.environment.grassLength - 25) * 0.02;

    return baseFriction * (conditionFactors[this.environment.pitchCondition] || 1) * grassFactor;
  }

  update(deltaTime: number): BallState {
    const dt = deltaTime;

    // Calculate all forces
    const drag = this.calculateDragForce();
    const magnus = this.calculateMagnusForce();
    const wind = this.calculateWindForce();

    // Total acceleration
    const ax = (drag.x + magnus.x + wind.x) / this.config.mass;
    const ay = (drag.y + magnus.y + wind.y) / this.config.mass;
    let az = -this.GRAVITY + (drag.z + magnus.z + wind.z) / this.config.mass;

    // Update velocity
    this.state.velocity.x += ax * dt;
    this.state.velocity.y += ay * dt;
    this.state.velocity.z += az * dt;

    // Update position
    this.state.position.x += this.state.velocity.x * dt;
    this.state.position.y += this.state.velocity.y * dt;
    this.state.position.z += this.state.velocity.z * dt;

    // Ground collision
    if (this.state.position.z <= 0) {
      this.state.position.z = 0;
      this.state.inAir = false;

      if (this.state.velocity.z < -0.5) {
        // Bounce
        this.state.velocity.z = -this.state.velocity.z * this.config.bounciness;
        // Lose some horizontal velocity on bounce
        this.state.velocity.x *= 0.85;
        this.state.velocity.y *= 0.85;
        this.state.inAir = true;
      } else {
        // Rolling on ground
        this.state.velocity.z = 0;
        const friction = this.getRollingFriction();
        const speed = Math.sqrt(this.state.velocity.x ** 2 + this.state.velocity.y ** 2);

        if (speed > 0.1) {
          const frictionDecel = friction * this.GRAVITY;
          const decelFactor = Math.max(0, 1 - (frictionDecel * dt) / speed);
          this.state.velocity.x *= decelFactor;
          this.state.velocity.y *= decelFactor;
        } else {
          this.state.velocity.x = 0;
          this.state.velocity.y = 0;
        }
      }
    } else {
      this.state.inAir = true;
    }

    // Spin decay
    const spinDecay = 0.98;
    this.state.angularVelocity.x *= spinDecay;
    this.state.angularVelocity.y *= spinDecay;
    this.state.angularVelocity.z *= spinDecay;

    // Keep ball in bounds (with bounce off posts/crossbar simulation)
    this.state.position.x = Math.max(0, Math.min(105, this.state.position.x));
    this.state.position.y = Math.max(0, Math.min(68, this.state.position.y));

    return { ...this.state };
  }

  kick(
    power: number,           // 0-100
    angle: number,           // Direction in radians (0 = right, π/2 = up)
    elevation: number,       // Launch angle in radians
    spin: Vector3D,          // Spin applied
    playerStrength: number   // 0-100 player's shot power attribute
  ): void {
    // Max kick speed ~35 m/s for elite players
    const maxSpeed = 25 + playerStrength * 0.1;
    const speed = (power / 100) * maxSpeed;

    this.state.velocity = {
      x: speed * Math.cos(elevation) * Math.cos(angle),
      y: speed * Math.cos(elevation) * Math.sin(angle),
      z: speed * Math.sin(elevation)
    };

    this.state.angularVelocity = spin;
    this.state.inAir = elevation > 0.05;
  }

  pass(
    target: Vector2D,
    power: number,
    passType: 'ground' | 'driven' | 'lofted' | 'chip',
    spin: 'none' | 'topspin' | 'backspin' | 'sidespin_left' | 'sidespin_right'
  ): void {
    const distance = Vector.distance(
      { x: this.state.position.x, y: this.state.position.y },
      target
    );

    const direction = Math.atan2(
      target.y - this.state.position.y,
      target.x - this.state.position.x
    );

    let elevation = 0;
    let spinVector: Vector3D = { x: 0, y: 0, z: 0 };

    switch (passType) {
      case 'ground':
        elevation = 0;
        break;
      case 'driven':
        elevation = 0.15;
        break;
      case 'lofted':
        elevation = 0.4 + (distance / 100) * 0.2;
        break;
      case 'chip':
        elevation = 0.6;
        break;
    }

    switch (spin) {
      case 'topspin':
        spinVector = { x: 20, y: 0, z: 0 };
        break;
      case 'backspin':
        spinVector = { x: -15, y: 0, z: 0 };
        break;
      case 'sidespin_left':
        spinVector = { x: 0, y: 0, z: 15 };
        break;
      case 'sidespin_right':
        spinVector = { x: 0, y: 0, z: -15 };
        break;
    }

    this.kick(power, direction, elevation, spinVector, 70);
  }

  getState(): BallState {
    return { ...this.state };
  }

  setState(state: Partial<BallState>): void {
    this.state = { ...this.state, ...state };
  }

  setEnvironment(env: Partial<EnvironmentalConditions>): void {
    this.environment = { ...this.environment, ...env };
  }
}

// ============================================================================
// PLAYER BIOMECHANICS
// ============================================================================

export interface PlayerPhysicalState {
  position: Vector2D;
  velocity: Vector2D;
  facing: number;           // Direction player is facing (radians)
  stamina: number;          // 0-100
  muscleLoad: number;       // Accumulated stress on muscles
  bodyTemperature: number;  // Celsius
  hydration: number;        // 0-100
}

export interface BiomechanicsProfile {
  maxSpeed: number;           // m/s
  acceleration: number;       // m/s²
  deceleration: number;       // m/s²
  agility: number;            // 0-100 (affects turning)
  balance: number;            // 0-100 (affects duels)
  jumpHeight: number;         // m
  sprintCapacity: number;     // seconds of max sprint
  recoveryRate: number;       // stamina recovery per second
  injuryProneness: number;    // 0-100
}

export interface MovementConstraints {
  turningRadius: number;      // Minimum turning radius at speed
  accelerationCurve: number;  // How acceleration changes with speed
  topSpeedMaintenance: number; // How long top speed can be held
}

export class PlayerBiomechanics {
  private state: PlayerPhysicalState;
  private profile: BiomechanicsProfile;
  private sprintDuration: number = 0;
  private injuryRisk: number = 0;

  constructor(profile: BiomechanicsProfile, initialPosition: Vector2D) {
    this.profile = profile;
    this.state = {
      position: initialPosition,
      velocity: { x: 0, y: 0 },
      facing: 0,
      stamina: 100,
      muscleLoad: 0,
      bodyTemperature: 37,
      hydration: 100
    };
  }

  private calculateMaxSpeedAtStamina(): number {
    // Speed decreases as stamina depletes
    const staminaFactor = 0.7 + 0.3 * (this.state.stamina / 100);
    const hydrationFactor = 0.85 + 0.15 * (this.state.hydration / 100);
    return this.profile.maxSpeed * staminaFactor * hydrationFactor;
  }

  private calculateAccelerationAtSpeed(currentSpeed: number): number {
    // Acceleration decreases as speed increases
    const speedRatio = currentSpeed / this.profile.maxSpeed;
    const accelerationFactor = 1 - Math.pow(speedRatio, 2);
    const staminaFactor = 0.6 + 0.4 * (this.state.stamina / 100);
    return this.profile.acceleration * accelerationFactor * staminaFactor;
  }

  private calculateTurningSpeed(currentSpeed: number, turnAngle: number): number {
    // Faster movement = slower turning
    const speedPenalty = Math.min(1, currentSpeed / (this.profile.maxSpeed * 0.5));
    const agilityBonus = this.profile.agility / 100;
    const turnRate = (2 + agilityBonus * 3) * (1 - speedPenalty * 0.7);

    // Can't turn more than turnRate radians per second
    return Math.min(Math.abs(turnAngle), turnRate) * Math.sign(turnAngle);
  }

  move(
    targetPosition: Vector2D,
    intensity: 'walk' | 'jog' | 'run' | 'sprint',
    deltaTime: number
  ): PlayerPhysicalState {
    const dt = deltaTime;

    // Target velocity based on intensity
    const intensityMultipliers = {
      walk: 0.2,
      jog: 0.4,
      run: 0.7,
      sprint: 1.0
    };

    const maxSpeed = this.calculateMaxSpeedAtStamina() * intensityMultipliers[intensity];
    const currentSpeed = Vector.magnitude(this.state.velocity);

    // Direction to target
    const toTarget = Vector.subtract(targetPosition, this.state.position);
    const distanceToTarget = Vector.magnitude(toTarget);

    if (distanceToTarget < 0.1) {
      // Arrived at target
      this.state.velocity = { x: 0, y: 0 };
      return { ...this.state };
    }

    const targetDirection = Vector.angle(toTarget);

    // Turn towards target
    let facingDiff = targetDirection - this.state.facing;
    // Normalize to -π to π
    while (facingDiff > Math.PI) facingDiff -= 2 * Math.PI;
    while (facingDiff < -Math.PI) facingDiff += 2 * Math.PI;

    const turnAmount = this.calculateTurningSpeed(currentSpeed, facingDiff) * dt;
    this.state.facing += turnAmount;

    // Can only accelerate in facing direction (with some sideways movement for agility)
    const moveDirection = this.state.facing;
    const sideMovement = facingDiff * (this.profile.agility / 200);

    // Calculate acceleration
    let acceleration: number;
    if (currentSpeed < maxSpeed) {
      acceleration = this.calculateAccelerationAtSpeed(currentSpeed);
    } else {
      acceleration = -this.profile.deceleration * 0.5; // Gradual slowdown if over max
    }

    // Apply acceleration in movement direction
    const accelVector = Vector.fromAngle(moveDirection + sideMovement, acceleration * dt);
    this.state.velocity = Vector.add(this.state.velocity, accelVector);

    // Limit to max speed
    const newSpeed = Vector.magnitude(this.state.velocity);
    if (newSpeed > maxSpeed) {
      this.state.velocity = Vector.multiply(
        Vector.normalize(this.state.velocity),
        maxSpeed
      );
    }

    // Decelerate if target is close
    if (distanceToTarget < 2) {
      const decelFactor = distanceToTarget / 2;
      this.state.velocity = Vector.multiply(this.state.velocity, decelFactor);
    }

    // Update position
    this.state.position = Vector.add(
      this.state.position,
      Vector.multiply(this.state.velocity, dt)
    );

    // Update stamina and physical state
    this.updatePhysicalState(intensity, dt);

    return { ...this.state };
  }

  private updatePhysicalState(intensity: 'walk' | 'jog' | 'run' | 'sprint', dt: number): void {
    // Stamina consumption rates
    const staminaRates = {
      walk: 0.5,   // Recovery
      jog: -0.5,
      run: -2,
      sprint: -5
    };

    this.state.stamina = Math.max(0, Math.min(100,
      this.state.stamina + staminaRates[intensity] * dt
    ));

    // Track sprint duration
    if (intensity === 'sprint') {
      this.sprintDuration += dt;
      if (this.sprintDuration > this.profile.sprintCapacity) {
        // Forced to slow down
        this.state.stamina = Math.max(0, this.state.stamina - 10 * dt);
      }
    } else {
      this.sprintDuration = Math.max(0, this.sprintDuration - dt * 0.5);
    }

    // Muscle load accumulation
    if (intensity === 'sprint' || intensity === 'run') {
      this.state.muscleLoad += dt * (intensity === 'sprint' ? 2 : 1);
    } else {
      this.state.muscleLoad = Math.max(0, this.state.muscleLoad - dt * 0.3);
    }

    // Body temperature regulation
    const targetTemp = intensity === 'sprint' ? 39 : intensity === 'run' ? 38.5 : 37;
    this.state.bodyTemperature += (targetTemp - this.state.bodyTemperature) * 0.1 * dt;

    // Hydration loss
    const hydrationLoss = intensity === 'sprint' ? 0.05 : intensity === 'run' ? 0.02 : 0.01;
    this.state.hydration = Math.max(0, this.state.hydration - hydrationLoss * dt);

    // Calculate injury risk
    this.calculateInjuryRisk();
  }

  private calculateInjuryRisk(): void {
    let risk = 0;

    // Base risk from profile
    risk += this.profile.injuryProneness * 0.1;

    // Risk from muscle load
    if (this.state.muscleLoad > 50) {
      risk += (this.state.muscleLoad - 50) * 0.5;
    }

    // Risk from low stamina
    if (this.state.stamina < 30) {
      risk += (30 - this.state.stamina) * 0.3;
    }

    // Risk from dehydration
    if (this.state.hydration < 70) {
      risk += (70 - this.state.hydration) * 0.2;
    }

    // Risk from overheating
    if (this.state.bodyTemperature > 39) {
      risk += (this.state.bodyTemperature - 39) * 10;
    }

    this.injuryRisk = Math.min(100, risk);
  }

  jump(height: 'low' | 'medium' | 'high'): number {
    const heightMultipliers = { low: 0.5, medium: 0.75, high: 1.0 };
    const staminaFactor = 0.7 + 0.3 * (this.state.stamina / 100);

    // Costs stamina
    this.state.stamina = Math.max(0, this.state.stamina - 3);
    this.state.muscleLoad += 2;

    return this.profile.jumpHeight * heightMultipliers[height] * staminaFactor;
  }

  tackle(targetPlayer: PlayerBiomechanics, isSlideTackle: boolean): {
    success: boolean;
    injuryToSelf: boolean;
    injuryToTarget: boolean;
    foul: boolean;
  } {
    const myBalance = this.profile.balance * (this.state.stamina / 100);
    const theirBalance = targetPlayer.profile.balance * (targetPlayer.state.stamina / 100);

    // Slide tackles are riskier but more effective
    const successChance = isSlideTackle ? 0.6 : 0.5;
    const foulChance = isSlideTackle ? 0.3 : 0.15;
    const injuryChance = isSlideTackle ? 0.05 : 0.02;

    const balanceAdvantage = (myBalance - theirBalance) / 100;

    // Stamina cost
    this.state.stamina = Math.max(0, this.state.stamina - (isSlideTackle ? 8 : 4));
    this.state.muscleLoad += isSlideTackle ? 5 : 2;

    return {
      success: Math.random() < successChance + balanceAdvantage * 0.2,
      injuryToSelf: Math.random() < injuryChance * (this.injuryRisk / 50),
      injuryToTarget: Math.random() < injuryChance * 0.5,
      foul: Math.random() < foulChance - balanceAdvantage * 0.1
    };
  }

  getState(): PlayerPhysicalState {
    return { ...this.state };
  }

  getInjuryRisk(): number {
    return this.injuryRisk;
  }

  recover(deltaTime: number): void {
    // Recovery when not moving
    this.state.stamina = Math.min(100,
      this.state.stamina + this.profile.recoveryRate * deltaTime
    );
    this.state.muscleLoad = Math.max(0, this.state.muscleLoad - deltaTime * 0.5);
    this.state.bodyTemperature += (37 - this.state.bodyTemperature) * 0.05 * deltaTime;
  }
}

// ============================================================================
// COLLISION DETECTION & RESPONSE
// ============================================================================

export interface CollisionResult {
  occurred: boolean;
  type: 'player_player' | 'player_ball' | 'ball_post' | 'ball_ground';
  impulse: Vector2D;
  foulProbability: number;
}

export function detectPlayerCollision(
  player1: PlayerPhysicalState,
  player2: PlayerPhysicalState,
  collisionRadius: number = 0.5
): CollisionResult {
  const distance = Vector.distance(player1.position, player2.position);

  if (distance >= collisionRadius * 2) {
    return { occurred: false, type: 'player_player', impulse: { x: 0, y: 0 }, foulProbability: 0 };
  }

  // Collision response
  const overlap = collisionRadius * 2 - distance;
  const direction = Vector.normalize(Vector.subtract(player2.position, player1.position));

  // Impulse based on relative velocity
  const relativeVelocity = Vector.subtract(player1.velocity, player2.velocity);
  const velocityAlongCollision = Vector.dot(relativeVelocity, direction);

  const impulse = Vector.multiply(direction, velocityAlongCollision * 0.5);

  // Foul probability based on impact force
  const impactForce = Math.abs(velocityAlongCollision);
  const foulProbability = Math.min(0.9, impactForce / 10);

  return {
    occurred: true,
    type: 'player_player',
    impulse,
    foulProbability
  };
}

export function predictBallTrajectory(
  ball: BallPhysics,
  timeSteps: number,
  stepSize: number = 0.1
): Vector3D[] {
  const trajectory: Vector3D[] = [];
  const tempBall = new BallPhysics();
  tempBall.setState(ball.getState());

  for (let i = 0; i < timeSteps; i++) {
    const state = tempBall.update(stepSize);
    trajectory.push({ ...state.position });
  }

  return trajectory;
}

export function calculateInterceptionPoint(
  playerPos: Vector2D,
  playerMaxSpeed: number,
  ballTrajectory: Vector3D[]
): { point: Vector2D; time: number; possible: boolean } {
  for (let i = 0; i < ballTrajectory.length; i++) {
    const ballPos = { x: ballTrajectory[i].x, y: ballTrajectory[i].y };
    const distance = Vector.distance(playerPos, ballPos);
    const timeToReach = distance / playerMaxSpeed;
    const ballTime = i * 0.1; // Assuming 0.1s steps

    if (timeToReach <= ballTime + 0.2) {
      return { point: ballPos, time: ballTime, possible: true };
    }
  }

  return { point: { x: 0, y: 0 }, time: Infinity, possible: false };
}
