import { Shape } from "three";

/** C outline from app/fonts/InterVariable.woff2, weight 800, optical size 32.
 * Centered and scaled to 0.86 units tall; no font loading at runtime.
 */
export function createCroinEmblem() {
  const shape = new Shape();
  shape.moveTo(0.012022, -0.43);
  shape.quadraticCurveTo(-0.102048, -0.43, -0.192913, -0.379116);
  shape.quadraticCurveTo(-0.283778, -0.328231, -0.33606, -0.231775);
  shape.quadraticCurveTo(-0.388342, -0.135319, -0.388342, -0.000559);
  shape.quadraticCurveTo(-0.388342, 0.135319, -0.33606, 0.231775);
  shape.quadraticCurveTo(-0.283778, 0.328231, -0.192913, 0.379116);
  shape.quadraticCurveTo(-0.102048, 0.43, 0.012022, 0.43);
  shape.quadraticCurveTo(0.088628, 0.43, 0.153212, 0.407354);
  shape.quadraticCurveTo(0.217796, 0.384707, 0.267282, 0.343049);
  shape.quadraticCurveTo(0.316769, 0.301391, 0.347802, 0.242958);
  shape.quadraticCurveTo(0.378836, 0.184525, 0.388342, 0.112952);
  shape.lineTo(0.185923, 0.112952);
  shape.quadraticCurveTo(0.179213, 0.146502, 0.164395, 0.172783);
  shape.quadraticCurveTo(0.149577, 0.199064, 0.12777, 0.217237);
  shape.quadraticCurveTo(0.105962, 0.23541, 0.077445, 0.244915);
  shape.quadraticCurveTo(0.048927, 0.254421, 0.015377, 0.254421);
  shape.quadraticCurveTo(-0.048927, 0.254421, -0.093661, 0.223667);
  shape.quadraticCurveTo(-0.138394, 0.192913, -0.162159, 0.136157);
  shape.quadraticCurveTo(-0.185923, 0.079402, -0.185923, -0.000559);
  shape.quadraticCurveTo(-0.185923, -0.079402, -0.162438, -0.136157);
  shape.quadraticCurveTo(-0.138953, -0.192913, -0.09394, -0.223667);
  shape.quadraticCurveTo(-0.048927, -0.254421, 0.014818, -0.254421);
  shape.quadraticCurveTo(0.048927, -0.254421, 0.077165, -0.245195);
  shape.quadraticCurveTo(0.105403, -0.235969, 0.127211, -0.217516);
  shape.quadraticCurveTo(0.149018, -0.199064, 0.163836, -0.173062);
  shape.quadraticCurveTo(0.178654, -0.147061, 0.185364, -0.11407);
  shape.lineTo(0.388342, -0.11407);
  shape.quadraticCurveTo(0.378277, -0.186203, 0.347523, -0.244077);
  shape.quadraticCurveTo(0.316769, -0.301951, 0.267003, -0.343609);
  shape.quadraticCurveTo(0.217237, -0.385267, 0.152932, -0.407633);
  shape.quadraticCurveTo(0.088628, -0.43, 0.012022, -0.43);
  shape.closePath();
  return shape;
}
