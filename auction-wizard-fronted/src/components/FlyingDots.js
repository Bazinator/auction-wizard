import React, { useRef, useEffect } from 'react';
import './CanvasAnimation.css';

const PARTICLE_NUM = 200;
const PARTICLE_BASE_RADIUS = 1;
const FL = 500;
const DEFAULT_SPEED = 0.5;

const CanvasAnimation = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    let centerX = canvasWidth * 0.5;
    let centerY = canvasHeight * 0.5;
    let speed = DEFAULT_SPEED;
    let particles = Array.from({ length: PARTICLE_NUM }, () => randomizeParticle());

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const loop = () => {
      context.fillStyle = 'rgb(0, 0, 0)';
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = 'rgb(255, 255, 255)';
      context.beginPath();

      speed += (DEFAULT_SPEED - speed) * 0.01;
      particles.forEach((p) => updateParticle(p, context, speed, centerX, centerY));

      context.fill();
      requestAnimationFrame(loop);
    };

    loop();

    window.addEventListener('resize', () => {
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      centerX = canvasWidth * 0.5;
      centerY = canvasHeight * 0.5;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    });
  }, []);

  const updateParticle = (p, context, speed, centerX, centerY) => {
    p.pastZ = p.z;
    p.z -= speed;

    if (p.z <= 0) {
      randomizeParticle(p);
      return;
    }

    const cx = centerX;
    const cy = centerY;
    const rx = p.x - cx;
    const ry = p.y - cy;

    const f = FL / p.z;
    const x = cx + rx * f;
    const y = cy + ry * f;
    const r = PARTICLE_BASE_RADIUS * f;

    const pf = FL / p.pastZ;
    const px = cx + rx * pf;
    const py = cy + ry * pf;
    const pr = PARTICLE_BASE_RADIUS * pf;

    const a = Math.atan2(py - y, px - x);
    const a1 = a + Math.PI * 0.5;
    const a2 = a - Math.PI * 0.5;

    context.moveTo(px + pr * Math.cos(a1), py + pr * Math.sin(a1));
    context.arc(px, py, pr, a1, a2, true);
    context.lineTo(x + r * Math.cos(a2), y + r * Math.sin(a2));
    context.arc(x, y, r, a2, a1, true);
    context.closePath();
  };

  const randomizeParticle = (p = {}) => {
    p.x = Math.random() * window.innerWidth;
    p.y = Math.random() * window.innerHeight;
    p.z = Math.random() * 1500 + 500;
    p.pastZ = 0;
    return p;
  };

  return <canvas ref={canvasRef}></canvas>;
};

export default CanvasAnimation;
