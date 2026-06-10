import { keyframes } from '@emotion/react'
import styled from '@emotion/styled'

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

export const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

export const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`

export const slideDown = keyframes`
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 800px;
  }
`

export const AnimatedPanel = styled.section<{ delay?: number }>`
  animation: ${fadeInUp} 0.45s ease-out both;
  animation-delay: ${({ delay = 0 }) => delay * 60}ms;
`

export const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  padding: max(0.75rem, env(safe-area-inset-top)) 0.75rem max(0.75rem, env(safe-area-inset-bottom));
  background: rgba(15, 23, 42, 0.55);
  animation: ${fadeIn} 0.2s ease-out both;
  -webkit-overflow-scrolling: touch;

  @media (min-width: 640px) {
    align-items: center;
    padding: 1rem;
  }
`

export const ModalCard = styled.div`
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: min(90dvh, calc(100vh - 1.5rem));
  margin: auto 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface);
  box-shadow: var(--shadow);
  animation: ${scaleIn} 0.28s ease-out both;

  @media (min-width: 640px) {
    margin: 0;
    max-height: min(90dvh, 90vh);
  }
`

export const ModalCardWide = styled(ModalCard)`
  max-width: 760px;
`

export const AnimatedTableRow = styled.tr<{ index?: number }>`
  animation: ${fadeInUp} 0.35s ease-out both;
  animation-delay: ${({ index = 0 }) => Math.min(index * 35, 350)}ms;
`

export const ExpandableDetail = styled.div`
  overflow: hidden;
  animation: ${slideDown} 0.35s ease-out both;
`
