'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, onValue, remove, off, Database, DatabaseReference } from 'firebase/database'
import { useSubscription } from '@/lib/useSubscription'

// Types
type GameMode = 'local' | 'ai' | 'online'
type PlayerSymbol = 'X' | 'O'
type CellValue = 'X' | 'O' | null
type GameState = 'menu' | 'playing' | 'gameover'

interface GameData {
  board: CellValue[][][]
  currentPlayer: PlayerSymbol
  player1Name: string
  player2Name: string
  player2Joined: boolean
  winner: string | null
  winningLine: number[][] | null
  lastMove: number[] | null
}

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "tictactoe-3d.firebaseapp.com",
  databaseURL: "https://tictactoe-3d-default-rtdb.firebaseio.com",
  projectId: "tictactoe-3d",
  storageBucket: "tictactoe-3d.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
}

// Winning combinations for 3D tic-tac-toe
// Board is [layer][row][col] where layer is vertical (y), row is depth (z), col is horizontal (x)
const WINNING_LINES = [
  // Rows on each layer (horizontal lines on each flat board)
  ...Array.from({ length: 3 }, (_, layer) =>
    Array.from({ length: 3 }, (_, row) =>
      [[layer, row, 0], [layer, row, 1], [layer, row, 2]]
    )
  ).flat(),
  // Columns on each layer (vertical lines on each flat board)
  ...Array.from({ length: 3 }, (_, layer) =>
    Array.from({ length: 3 }, (_, col) =>
      [[layer, 0, col], [layer, 1, col], [layer, 2, col]]
    )
  ).flat(),
  // Diagonals on each layer
  ...Array.from({ length: 3 }, (_, layer) => [
    [[layer, 0, 0], [layer, 1, 1], [layer, 2, 2]],
    [[layer, 0, 2], [layer, 1, 1], [layer, 2, 0]]
  ]).flat(),
  // Vertical columns through all layers
  ...Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) =>
      [[0, row, col], [1, row, col], [2, row, col]]
    )
  ).flat(),
  // Diagonals through layers (front-back)
  ...Array.from({ length: 3 }, (_, col) => [
    [[0, 0, col], [1, 1, col], [2, 2, col]],
    [[0, 2, col], [1, 1, col], [2, 0, col]]
  ]).flat(),
  // Diagonals through layers (left-right)
  ...Array.from({ length: 3 }, (_, row) => [
    [[0, row, 0], [1, row, 1], [2, row, 2]],
    [[0, row, 2], [1, row, 1], [2, row, 0]]
  ]).flat(),
  // Space diagonals (corner to corner through center)
  [[0, 0, 0], [1, 1, 1], [2, 2, 2]],
  [[0, 0, 2], [1, 1, 1], [2, 2, 0]],
  [[0, 2, 0], [1, 1, 1], [2, 0, 2]],
  [[0, 2, 2], [1, 1, 1], [2, 0, 0]]
]

export default function TicTacToe3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cellMeshesRef = useRef<THREE.Mesh[][][]>([])
  const markerMeshesRef = useRef<THREE.Group[][][]>([])
  const gridGroupRef = useRef<THREE.Group | null>(null)
  const animationIdRef = useRef<number>(0)
  const handleCellClickRef = useRef<(layer: number, row: number, col: number, isAI?: boolean) => void>(() => {})
  
  // Mouse rotation state
  const isDraggingRef = useRef(false)
  const previousMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ x: 0, y: 0 })

  const [gameState, setGameState] = useState<GameState>('menu')
  const [gameMode, setGameMode] = useState<GameMode>('local')
  const [board, setBoard] = useState<CellValue[][][]>(() =>
    Array(3).fill(null).map(() =>
      Array(3).fill(null).map(() =>
        Array(3).fill(null)
      )
    )
  )
  const [currentPlayer, setCurrentPlayer] = useState<PlayerSymbol>('X')
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol>('X')
  const [player1Name, setPlayer1Name] = useState('Player 1')
  const [player2Name, setPlayer2Name] = useState('Player 2')
  const [winner, setWinner] = useState<string | null>(null)
  const [winningLine, setWinningLine] = useState<number[][] | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [onlinePlayerName, setOnlinePlayerName] = useState('')
  const [waitingForPlayer, setWaitingForPlayer] = useState(false)
  const waitingForPlayerRef = useRef(false)
  const gameModeRef = useRef<GameMode>('local')
  const playerSymbolRef = useRef<PlayerSymbol>('X')
  const currentPlayerRef = useRef<PlayerSymbol>('X')
  const [statusMessage, setStatusMessage] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [showingWin, setShowingWin] = useState(false)

  const databaseRef = useRef<Database | null>(null)
  const gameRef = useRef<DatabaseReference | null>(null)

  const { user, isSubscribed, loading, signIn, signOut, checkout } = useSubscription()

  // Initialize Firebase
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig)
      databaseRef.current = getDatabase(app)
    } catch {
      console.log('Firebase already initialized')
    }
  }, [])

  // Create X marker (cross shape) - lies flat on the layer
  const createXMarker = useCallback((position: THREE.Vector3, isWinning = false) => {
    const group = new THREE.Group()
    const color = isWinning ? 0xffff00 : 0x667eea
    const material = new THREE.MeshPhongMaterial({ 
      color, 
      emissive: isWinning ? 0x444400 : 0x000000,
      emissiveIntensity: isWinning ? 0.5 : 0
    })
    
    // Create two crossed bars lying flat
    const barGeometry = new THREE.BoxGeometry(0.6, 0.08, 0.12)
    
    const bar1 = new THREE.Mesh(barGeometry, material)
    bar1.rotation.y = Math.PI / 4
    group.add(bar1)
    
    const bar2 = new THREE.Mesh(barGeometry, material)
    bar2.rotation.y = -Math.PI / 4
    group.add(bar2)
    
    group.position.copy(position)
    return group
  }, [])

  // Create O marker (torus/ring shape) - lies flat on the layer
  const createOMarker = useCallback((position: THREE.Vector3, isWinning = false) => {
    const group = new THREE.Group()
    const color = isWinning ? 0xffff00 : 0xf093fb
    const material = new THREE.MeshPhongMaterial({ 
      color,
      emissive: isWinning ? 0x444400 : 0x000000,
      emissiveIntensity: isWinning ? 0.5 : 0
    })
    
    const torusGeometry = new THREE.TorusGeometry(0.22, 0.05, 16, 32)
    const torus = new THREE.Mesh(torusGeometry, material)
    torus.rotation.x = Math.PI / 2 // Lie flat
    group.add(torus)
    
    group.position.copy(position)
    return group
  }, [])

  // Check for winner
  const checkWinner = useCallback((boardState: CellValue[][][]): { winner: PlayerSymbol | null; line: number[][] | null } => {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line
      const valA = boardState[a[0]][a[1]][a[2]]
      const valB = boardState[b[0]][b[1]][b[2]]
      const valC = boardState[c[0]][c[1]][c[2]]

      if (valA && valA === valB && valB === valC) {
        return { winner: valA, line }
      }
    }
    return { winner: null, line: null }
  }, [])

  // Check for draw
  const checkDraw = useCallback((boardState: CellValue[][][]): boolean => {
    for (let layer = 0; layer < 3; layer++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (!boardState[layer][row][col]) return false
        }
      }
    }
    return true
  }, [])

  // Find best move for a player
  const findBestMove = useCallback((boardState: CellValue[][][], player: PlayerSymbol): number[] | null => {
    for (const line of WINNING_LINES) {
      const values = line.map(([layer, row, col]) => boardState[layer][row][col])
      const playerCount = values.filter(v => v === player).length
      const emptyCount = values.filter(v => v === null).length

      if (playerCount === 2 && emptyCount === 1) {
        const emptyIndex = values.findIndex(v => v === null)
        return line[emptyIndex]
      }
    }
    return null
  }, [])

  // Handle cell click
  const handleCellClick = useCallback((layer: number, row: number, col: number, isAI = false) => {
    if (winner || showingWin) return
    if (board[layer][row][col]) return

    // Check if it's player's turn in online mode
    if (gameModeRef.current === 'online' && !isAI) {
      const isMyTurn = currentPlayerRef.current === playerSymbolRef.current
      if (!isMyTurn) {
        setStatusMessage("Wait for your opponent's move")
        return
      }
    }

    const newBoard = board.map((layerArr, l) =>
      layerArr.map((rowArr, r) =>
        rowArr.map((cell, c) =>
          l === layer && r === row && c === col ? currentPlayer : cell
        )
      )
    )

    setBoard(newBoard)

    // Check for winner
    const result = checkWinner(newBoard)
    if (result.winner) {
      const winnerName = result.winner === 'X' ? player1Name : player2Name
      setWinner(winnerName)
      setWinningLine(result.line)
      setShowingWin(true)
      setStatusMessage(`${winnerName} wins! 🎉`)

      // Delay before showing game over screen
      setTimeout(() => {
        setShowingWin(false)
        setGameState('gameover')
      }, 5000)

      if (gameModeRef.current === 'online' && gameRef.current) {
        set(gameRef.current, {
          board: newBoard,
          currentPlayer: currentPlayer === 'X' ? 'O' : 'X',
          player1Name,
          player2Name,
          player2Joined: true,
          winner: winnerName,
          winningLine: result.line,
          lastMove: [layer, row, col]
        })
      }
      return
    }

    // Check for draw
    if (checkDraw(newBoard)) {
      setWinner('Draw')
      setShowingWin(true)
      setStatusMessage("It's a draw!")
      setTimeout(() => {
        setShowingWin(false)
        setGameState('gameover')
      }, 3000)
      return
    }

    // Switch player
    const nextPlayer = currentPlayer === 'X' ? 'O' : 'X'
    setCurrentPlayer(nextPlayer)
    currentPlayerRef.current = nextPlayer
    setStatusMessage(`${nextPlayer === 'X' ? player1Name : player2Name}'s turn`)

    // Update online game
    if (gameModeRef.current === 'online' && gameRef.current) {
      set(gameRef.current, {
        board: newBoard,
        currentPlayer: nextPlayer,
        player1Name,
        player2Name,
        player2Joined: true,
        winner: null,
        winningLine: null,
        lastMove: [layer, row, col]
      })
    }

    // AI move
    if (gameMode === 'ai' && nextPlayer === 'O' && !isAI) {
      setTimeout(() => {
        makeAIMove(newBoard)
      }, 500)
    }
  }, [board, currentPlayer, winner, showingWin, gameMode, playerSymbol, player1Name, player2Name, checkWinner, checkDraw])

  // Keep ref updated with latest handleCellClick
  useEffect(() => {
    handleCellClickRef.current = handleCellClick
  }, [handleCellClick])

  // AI Move
  const makeAIMove = useCallback((boardState: CellValue[][][]) => {
    const emptyCells: number[][] = []
    for (let layer = 0; layer < 3; layer++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (!boardState[layer][row][col]) {
            emptyCells.push([layer, row, col])
          }
        }
      }
    }

    if (emptyCells.length === 0) return

    let move: number[] | null = null

    if (aiDifficulty === 'hard') {
      // Try to win
      move = findBestMove(boardState, 'O')
      // Block player
      if (!move) move = findBestMove(boardState, 'X')
      // Take center if available
      if (!move && !boardState[1][1][1]) move = [1, 1, 1]
    } else if (aiDifficulty === 'medium') {
      // 50% chance to play smart
      if (Math.random() > 0.5) {
        move = findBestMove(boardState, 'O')
        if (!move) move = findBestMove(boardState, 'X')
      }
    }

    // Random move as fallback
    if (!move) {
      move = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    }

    handleCellClickRef.current(move[0], move[1], move[2], true)
  }, [aiDifficulty, findBestMove])

  // Update markers when board changes
  useEffect(() => {
    if (gameState !== 'playing' || !gridGroupRef.current) return
    
    // Ensure board is properly initialized
    if (!board || !board[0] || !board[0][0]) return

    const gridGroup = gridGroupRef.current

    // Clear old markers
    for (let layer = 0; layer < 3; layer++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const oldMarker = markerMeshesRef.current[layer]?.[row]?.[col]
          if (oldMarker) {
            gridGroup.remove(oldMarker)
          }
        }
      }
    }

    // Initialize marker array if needed
    if (markerMeshesRef.current.length === 0) {
      markerMeshesRef.current = Array(3).fill(null).map(() =>
        Array(3).fill(null).map(() =>
          Array(3).fill(null)
        )
      )
    }

    // Create new markers
    // Layer spacing: layers are stacked vertically with good separation
    const layerSpacing = 2.0
    const cellSpacing = 1.2
    
    for (let layer = 0; layer < 3; layer++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const value = board[layer][row][col]
          if (value) {
            const x = (col - 1) * cellSpacing
            const y = (layer - 1) * layerSpacing
            const z = (row - 1) * cellSpacing
            const position = new THREE.Vector3(x, y, z)
            const isWinning = winningLine?.some(([wl, wr, wc]) => wl === layer && wr === row && wc === col) || false
            
            if (markerMeshesRef.current[layer]?.[row] !== undefined) {
              if (value === 'X') {
                markerMeshesRef.current[layer][row][col] = createXMarker(position, isWinning)
              } else {
                markerMeshesRef.current[layer][row][col] = createOMarker(position, isWinning)
              }
              gridGroup.add(markerMeshesRef.current[layer][row][col])
            }
          }
        }
      }
    }
  }, [board, winningLine, gameState, createXMarker, createOMarker])

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || gameState !== 'playing') return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    // Camera - positioned to look down at the layers from an angle
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 8, 8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    scene.add(directionalLight)
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight2.position.set(-5, -5, -5)
    scene.add(directionalLight2)

    // Create a group for the entire grid (for rotation)
    const gridGroup = new THREE.Group()
    scene.add(gridGroup)
    gridGroupRef.current = gridGroup

    // Layer spacing
    const layerSpacing = 2.0
    const cellSpacing = 1.2
    const gridSize = cellSpacing * 2

    // Create 3 horizontal layers
    const layerMaterial = new THREE.LineBasicMaterial({ color: 0x4a5568, transparent: true, opacity: 0.6 })
    const layerColors = [0x667eea, 0x48bb78, 0xf093fb] // Different colors for each layer

    for (let layer = 0; layer < 3; layer++) {
      const y = (layer - 1) * layerSpacing
      
      // Create grid lines for this layer
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: layerColors[layer], 
        transparent: true, 
        opacity: 0.4 
      })

      // Horizontal lines (along X)
      for (let i = 0; i <= 3; i++) {
        const z = (i - 1.5) * cellSpacing
        const points = [
          new THREE.Vector3(-gridSize / 2 - cellSpacing / 2, y, z),
          new THREE.Vector3(gridSize / 2 + cellSpacing / 2, y, z)
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        gridGroup.add(new THREE.Line(geometry, lineMaterial))
      }

      // Vertical lines (along Z)
      for (let i = 0; i <= 3; i++) {
        const x = (i - 1.5) * cellSpacing
        const points = [
          new THREE.Vector3(x, y, -gridSize / 2 - cellSpacing / 2),
          new THREE.Vector3(x, y, gridSize / 2 + cellSpacing / 2)
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        gridGroup.add(new THREE.Line(geometry, lineMaterial))
      }

      // Add layer label
      // (Optional: could add text sprites here)
    }

    // Create vertical connecting lines between layers
    const connectMaterial = new THREE.LineBasicMaterial({ color: 0x4a5568, transparent: true, opacity: 0.2 })
    for (let i = 0; i <= 3; i++) {
      for (let j = 0; j <= 3; j++) {
        const x = (i - 1.5) * cellSpacing
        const z = (j - 1.5) * cellSpacing
        const points = [
          new THREE.Vector3(x, -layerSpacing, z),
          new THREE.Vector3(x, layerSpacing, z)
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        gridGroup.add(new THREE.Line(geometry, connectMaterial))
      }
    }

    // Create invisible clickable cells
    const cells: THREE.Mesh[][][] = []
    for (let layer = 0; layer < 3; layer++) {
      cells[layer] = []
      for (let row = 0; row < 3; row++) {
        cells[layer][row] = []
        for (let col = 0; col < 3; col++) {
          // Flat clickable area for each cell
          const geometry = new THREE.BoxGeometry(cellSpacing * 0.9, 0.3, cellSpacing * 0.9)
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
          })
          const mesh = new THREE.Mesh(geometry, material)
          const x = (col - 1) * cellSpacing
          const y = (layer - 1) * layerSpacing
          const z = (row - 1) * cellSpacing
          mesh.position.set(x, y, z)
          mesh.userData = { layer, row, col }
          gridGroup.add(mesh)
          cells[layer][row][col] = mesh
        }
      }
    }
    cellMeshesRef.current = cells

    // Reset marker meshes
    markerMeshesRef.current = []

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      
      // Apply rotation to grid group
      gridGroup.rotation.y = rotationRef.current.y
      gridGroup.rotation.x = rotationRef.current.x
      
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Mouse rotation controls
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      isDraggingRef.current = true
      previousMouseRef.current = { x: event.clientX, y: event.clientY }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return
      
      const deltaX = event.clientX - previousMouseRef.current.x
      const deltaY = event.clientY - previousMouseRef.current.y
      
      rotationRef.current.y += deltaX * 0.01
      rotationRef.current.x += deltaY * 0.01
      
      // Limit vertical rotation to keep layers visible
      rotationRef.current.x = Math.max(-0.5, Math.min(0.8, rotationRef.current.x))
      
      previousMouseRef.current = { x: event.clientX, y: event.clientY }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    // Handle clicks for cell selection
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let clickStartTime = 0
    let clickStartPos = { x: 0, y: 0 }

    const handleClickStart = (event: MouseEvent) => {
      clickStartTime = Date.now()
      clickStartPos = { x: event.clientX, y: event.clientY }
    }

    const handleClick = (event: MouseEvent) => {
      // Only register click if it was quick and didn't move much
      const clickDuration = Date.now() - clickStartTime
      const clickDistance = Math.sqrt(
        Math.pow(event.clientX - clickStartPos.x, 2) + 
        Math.pow(event.clientY - clickStartPos.y, 2)
      )
      
      if (clickDuration > 300 || clickDistance > 10) return
      
      const rect = container.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const allCells = cells.flat(2)
      const intersects = raycaster.intersectObjects(allCells)

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh
        const { layer, row, col } = mesh.userData
        handleCellClickRef.current(layer, row, col)
      }
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousedown', handleClickStart)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('mouseup', handleClick)
    container.addEventListener('mouseleave', handleMouseUp)

    // Touch support
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        isDraggingRef.current = true
        previousMouseRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
        clickStartTime = Date.now()
        clickStartPos = { x: event.touches[0].clientX, y: event.touches[0].clientY }
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isDraggingRef.current || event.touches.length !== 1) return
      
      const deltaX = event.touches[0].clientX - previousMouseRef.current.x
      const deltaY = event.touches[0].clientY - previousMouseRef.current.y
      
      rotationRef.current.y += deltaX * 0.01
      rotationRef.current.x += deltaY * 0.01
      rotationRef.current.x = Math.max(-0.5, Math.min(0.8, rotationRef.current.x))
      
      previousMouseRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      isDraggingRef.current = false
      
      const clickDuration = Date.now() - clickStartTime
      const touch = event.changedTouches[0]
      const clickDistance = Math.sqrt(
        Math.pow(touch.clientX - clickStartPos.x, 2) + 
        Math.pow(touch.clientY - clickStartPos.y, 2)
      )
      
      if (clickDuration < 300 && clickDistance < 20) {
        const rect = container.getBoundingClientRect()
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const allCells = cells.flat(2)
        const intersects = raycaster.intersectObjects(allCells)

        if (intersects.length > 0) {
          const mesh = intersects[0].object as THREE.Mesh
          const { layer, row, col } = mesh.userData
          handleCellClickRef.current(layer, row, col)
        }
      }
    }

    container.addEventListener('touchstart', handleTouchStart)
    container.addEventListener('touchmove', handleTouchMove)
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      cancelAnimationFrame(animationIdRef.current)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousedown', handleClickStart)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('mouseup', handleClick)
      container.removeEventListener('mouseleave', handleMouseUp)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      if (renderer.domElement.parentNode) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [gameState])

  // Game functions
  const resetBoard = () => {
    setBoard(
      Array(3).fill(null).map(() =>
        Array(3).fill(null).map(() =>
          Array(3).fill(null)
        )
      )
    )
    setCurrentPlayer('X')
    currentPlayerRef.current = 'X'
    setWinner(null)
    setWinningLine(null)
    setShowingWin(false)
    rotationRef.current = { x: 0, y: 0 }
  }

  const startLocalGame = () => {
    resetBoard()
    setGameMode('local')
    gameModeRef.current = 'local'
    playerSymbolRef.current = 'X'
    setPlayer1Name('Player 1')
    setPlayer2Name('Player 2')
    setStatusMessage("Player 1's turn (X)")
    setGameState('playing')
  }

  const startAIGame = () => {
    resetBoard()
    setGameMode('ai')
    gameModeRef.current = 'ai'
    playerSymbolRef.current = 'X'
    setPlayer1Name('You')
    setPlayer2Name('AI')
    setStatusMessage('Your turn (X)')
    setGameState('playing')
  }

  const generateGameCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = () => {
    if (!onlinePlayerName.trim()) {
      setStatusMessage('Please enter your name')
      return
    }
    if (!databaseRef.current) {
      setStatusMessage('Connection error')
      return
    }

    const code = generateGameCode()
    setGameCode(code)
    setPlayerSymbol('X')
    playerSymbolRef.current = 'X'
    setPlayer1Name(onlinePlayerName)
    setWaitingForPlayer(true)
    waitingForPlayerRef.current = true

    const gameReference = ref(databaseRef.current, `games/${code}`)
    gameRef.current = gameReference

    const initialData: GameData = {
      board: Array(3).fill(null).map(() =>
        Array(3).fill(null).map(() =>
          Array(3).fill(null)
        )
      ),
      currentPlayer: 'X',
      player1Name: onlinePlayerName,
      player2Name: '',
      player2Joined: false,
      winner: null,
      winningLine: null,
      lastMove: null
    }

    set(gameReference, initialData)

    onValue(gameReference, (snapshot) => {
      const data = snapshot.val() as GameData
      if (data) {
        setBoard(data.board)
        setCurrentPlayer(data.currentPlayer)
        currentPlayerRef.current = data.currentPlayer
        currentPlayerRef.current = data.currentPlayer
        setPlayer2Name(data.player2Name || 'Waiting...')
        
        if (data.player2Joined && waitingForPlayerRef.current) {
          setWaitingForPlayer(false)
          waitingForPlayerRef.current = false
          setGameMode('online')
          gameModeRef.current = 'online'
          setStatusMessage(`${data.currentPlayer === 'X' ? data.player1Name : data.player2Name}'s turn`)
          setGameState('playing')
        }

        if (data.winner) {
          setWinner(data.winner)
          setWinningLine(data.winningLine)
          setShowingWin(true)
          setTimeout(() => {
            setShowingWin(false)
            setGameState('gameover')
          }, 5000)
        }
      }
    })
  }

  const joinRoom = () => {
    if (!onlinePlayerName.trim()) {
      setStatusMessage('Please enter your name')
      return
    }
    if (!joinCode.trim()) {
      setStatusMessage('Please enter a game code')
      return
    }
    if (!databaseRef.current) {
      setStatusMessage('Connection error')
      return
    }

    const gameReference = ref(databaseRef.current, `games/${joinCode}`)
    gameRef.current = gameReference

    onValue(gameReference, (snapshot) => {
      const data = snapshot.val() as GameData
      if (!data) {
        setStatusMessage('Game not found')
        off(gameReference)
        return
      }

      if (!data.player2Joined) {
        set(gameReference, {
          ...data,
          player2Name: onlinePlayerName,
          player2Joined: true
        })
        setPlayerSymbol('O')
        playerSymbolRef.current = 'O'
        setGameCode(joinCode)
      }

      setBoard(data.board)
      setCurrentPlayer(data.currentPlayer)
      currentPlayerRef.current = data.currentPlayer
      setPlayer1Name(data.player1Name)
      setPlayer2Name(data.player2Joined ? data.player2Name : onlinePlayerName)
      setGameMode('online')
      gameModeRef.current = 'online'
      setStatusMessage(`${data.currentPlayer === 'X' ? data.player1Name : (data.player2Name || onlinePlayerName)}'s turn`)
      setGameState('playing')

      if (data.winner) {
        setWinner(data.winner)
        setWinningLine(data.winningLine)
        setShowingWin(true)
        setTimeout(() => {
          setShowingWin(false)
          setGameState('gameover')
        }, 5000)
      }
    }, { onlyOnce: false })
  }

  const playAgain = () => {
    resetBoard()
    setStatusMessage(`${player1Name}'s turn (X)`)
    setGameState('playing')

    if (gameModeRef.current === 'online' && gameRef.current) {
      set(gameRef.current, {
        board: Array(3).fill(null).map(() =>
          Array(3).fill(null).map(() =>
            Array(3).fill(null)
          )
        ),
        currentPlayer: 'X',
        player1Name,
        player2Name,
        player2Joined: true,
        winner: null,
        winningLine: null,
        lastMove: null
      })
    }
  }

  const backToMenu = () => {
    if (gameRef.current) {
      remove(gameRef.current)
      off(gameRef.current)
      gameRef.current = null
    }
    resetBoard()
    setGameState('menu')
    setWaitingForPlayer(false)
    waitingForPlayerRef.current = false
    gameModeRef.current = 'local'
    playerSymbolRef.current = 'X'
    setGameCode('')
    setJoinCode('')
    setStatusMessage('')
  }

  // Render Menu
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col items-center justify-center p-4 text-white">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-[#667eea] to-[#f093fb] bg-clip-text text-transparent">
          3D Tic-Tac-Toe
        </h1>
        <p className="text-gray-400 mb-8">Play in three dimensions!</p>

        {/* Auth Section */}
        <div className="mb-6">
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : user ? (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">
                Signed in as {user.email}
                {isSubscribed && <span className="ml-2 text-green-400">⭐ Premium</span>}
              </p>
              <button
                onClick={signOut}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              Sign in with Google
            </button>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-2xl">
          {/* Single Player Section */}
          <div className="mb-8">
            <h3 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Single Player</h3>
            <button
              onClick={startLocalGame}
              className="w-full py-4 px-6 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl font-semibold hover:opacity-90 transition mb-3"
            >
              🎮 Local Game (2 Players)
            </button>
            <button
              onClick={startAIGame}
              className="w-full py-4 px-6 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition mb-3"
            >
              🤖 Play vs AI
            </button>
            <div className="flex gap-2 justify-center">
              {(['easy', 'medium', 'hard'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setAiDifficulty(diff)}
                  className={`px-4 py-2 rounded-lg text-sm transition ${
                    aiDifficulty === diff
                      ? 'bg-[#667eea] text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Multiplayer Section */}
          <div className="mb-6">
            <h3 className="text-sm uppercase tracking-widest text-gray-500 mb-4">
              Online Multiplayer
              {!isSubscribed && <span className="ml-2 text-yellow-500">⭐ Premium</span>}
            </h3>

            <input
              type="text"
              value={onlinePlayerName}
              onChange={(e) => setOnlinePlayerName(e.target.value)}
              placeholder="Your name"
              maxLength={12}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl mb-3 focus:outline-none focus:border-[#667eea] transition"
            />

            {isSubscribed ? (
              <>
                <button
                  onClick={createRoom}
                  className="w-full py-4 px-6 bg-gradient-to-r from-[#f093fb] to-[#f5576c] rounded-xl font-semibold hover:opacity-90 transition mb-3"
                >
                  🌐 Create Room
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Game code"
                    maxLength={6}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#667eea] transition uppercase"
                  />
                  <button
                    onClick={joinRoom}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition"
                  >
                    Join
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                {user ? (<p className="text-gray-400 mb-4">Choose a plan to unlock online multiplayer!</p>) : (<p className="text-gray-400 mb-4">Sign in first, then subscribe to play online!</p>)}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => user ? checkout('monthly') : signIn()}
                    className="px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl font-semibold hover:opacity-90 transition"
                  >
                    $1.99/mo
                  </button>
                  <button
                    onClick={() => user ? checkout('annual') : signIn()}
                    className="px-6 py-3 bg-gradient-to-r from-[#f093fb] to-[#f5576c] rounded-xl font-semibold hover:opacity-90 transition"
                  >
                    $10/year
                  </button>
                </div>
              </div>
            )}
          </div>

          {statusMessage && (
            <p className="text-center text-yellow-400 mt-4">{statusMessage}</p>
          )}

          {waitingForPlayer && (
            <div className="text-center mt-4">
              <p className="text-gray-400 mb-2">Share this code with your friend:</p>
              <p className="text-3xl font-mono font-bold text-[#667eea]">{gameCode}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render Game Over
  if (gameState === 'gameover') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            {winner === 'Draw' ? "It's a Draw!" : `${winner} Wins!`}
          </h2>
          <p className="text-gray-400 mb-6">
            {winner === 'Draw'
              ? 'Great game! No one could claim victory.'
              : 'Congratulations on the victory!'}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={playAgain}
              className="px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl font-semibold hover:opacity-90 transition"
            >
              Play Again
            </button>
            <button
              onClick={backToMenu}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render Playing State
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col text-white">
      {/* Header */}
      <div className="p-4 flex justify-between items-center">
        <button
          onClick={backToMenu}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
        >
          ← Back
        </button>
        <div className="text-center">
          <p className="text-sm text-gray-400">
            {gameMode === 'online' && gameCode && `Room: ${gameCode}`}
          </p>
          <p className="font-semibold">{statusMessage}</p>
        </div>
        <div className="w-20" />
      </div>

      {/* Player Info */}
      <div className="flex justify-center gap-8 px-4 mb-2">
        <div className={`px-6 py-3 rounded-xl transition ${
          currentPlayer === 'X'
            ? 'bg-[#667eea]/30 border-2 border-[#667eea]'
            : 'bg-white/5'
        }`}>
          <span className="text-[#667eea] font-bold text-xl">✕</span>
          <span className="ml-2">{player1Name}</span>
        </div>
        <div className={`px-6 py-3 rounded-xl transition ${
          currentPlayer === 'O'
            ? 'bg-[#f093fb]/30 border-2 border-[#f093fb]'
            : 'bg-white/5'
        }`}>
          <span className="text-[#f093fb] font-bold text-xl">○</span>
          <span className="ml-2">{player2Name}</span>
        </div>
      </div>

      {/* Layer indicators */}
      <div className="flex justify-center gap-4 px-4 mb-2 text-sm">
        <span className="text-[#667eea]">● Top Layer</span>
        <span className="text-[#48bb78]">● Middle Layer</span>
        <span className="text-[#f093fb]">● Bottom Layer</span>
      </div>

      {/* Game Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full cursor-grab active:cursor-grabbing"
        style={{ minHeight: '400px', touchAction: 'none' }}
      />

      {/* Instructions */}
      <div className="p-4 text-center text-gray-400 text-sm">
        <p>🖱️ Drag to rotate view • Click a cell to place your mark • Get 3 in a row to win!</p>
      </div>
    </div>
  )
}
