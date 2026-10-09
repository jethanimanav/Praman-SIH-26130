"""
Directed Acyclic Graph (DAG) Engine for Approval Sequencing.

Provides:
- Node modeling with duration, prerequisites, and metadata
- Cycle detection using DFS depth tracking
- Topological sorting (Kahn's algorithm / DFS post-order)
- Parallel execution group (wave) partitioning
- Critical path calculation (longest cumulative duration path via DP)
- React Flow export for graph rendering
"""
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict, deque


class CycleDetectedException(Exception):
    """Raised when a cyclical dependency is detected in the approval graph."""
    def __init__(self, cycle_path: List[str]):
        self.cycle_path = cycle_path
        super().__init__(f"Cycle detected in approval DAG: {' -> '.join(cycle_path)}")


class DAGNode:
    def __init__(
        self,
        id: str,
        name: str,
        duration: int = 0,
        department: Optional[str] = None,
        prerequisites: Optional[List[str]] = None,
        data_status: str = "DEMO",
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.id = id
        self.name = name
        self.duration = duration
        self.department = department
        self.prerequisites: List[str] = prerequisites or []
        self.dependents: List[str] = []
        self.data_status = data_status
        self.extra: Dict[str, Any] = extra or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "duration": self.duration,
            "department": self.department,
            "prerequisites": self.prerequisites,
            "dependents": self.dependents,
            "data_status": self.data_status,
            "extra": self.extra,
        }


class ApprovalDAG:
    def __init__(self):
        self.nodes: Dict[str, DAGNode] = {}

    def add_node(
        self,
        id: str,
        name: str,
        duration: int = 0,
        department: Optional[str] = None,
        prerequisites: Optional[List[str]] = None,
        data_status: str = "DEMO",
        extra: Optional[Dict[str, Any]] = None,
    ) -> DAGNode:
        """Adds or updates a node in the DAG."""
        node = DAGNode(
            id=id,
            name=name,
            duration=duration,
            department=department,
            prerequisites=prerequisites or [],
            data_status=data_status,
            extra=extra,
        )
        self.nodes[id] = node
        return node

    def build_edges(self, filter_existing_prereqs_only: bool = True):
        """
        Builds bidirectional edges between prerequisites and dependents.
        If filter_existing_prereqs_only is True, drops prerequisites that do not exist in the graph
        (e.g., optional conditional requirements that were not selected).
        """
        for node in self.nodes.values():
            node.dependents = []

        for node_id, node in self.nodes.items():
            valid_prereqs = []
            for prereq_id in node.prerequisites:
                if prereq_id in self.nodes:
                    valid_prereqs.append(prereq_id)
                    if node_id not in self.nodes[prereq_id].dependents:
                        self.nodes[prereq_id].dependents.append(node_id)
                elif not filter_existing_prereqs_only:
                    valid_prereqs.append(prereq_id)
            node.prerequisites = valid_prereqs

    def detect_cycles(self) -> Optional[List[str]]:
        """
        Checks for cycles in the graph using DFS with 3-state tracking:
        0 = unvisited, 1 = visiting (in current recursion stack), 2 = visited.
        Returns the cycle path if found, or None if the graph is a valid DAG.
        """
        self.build_edges()
        visited: Dict[str, int] = {node_id: 0 for node_id in self.nodes}
        parent: Dict[str, Optional[str]] = {node_id: None for node_id in self.nodes}
        cycle_path: List[str] = []

        def dfs(u: str) -> bool:
            visited[u] = 1  # visiting
            for v in self.nodes[u].dependents:
                if visited[v] == 1:
                    # Found cycle: reconstruct path from u back to v
                    curr = u
                    cycle_path.append(v)
                    while curr and curr != v:
                        cycle_path.append(curr)
                        curr = parent.get(curr)
                    cycle_path.append(v)
                    cycle_path.reverse()
                    return True
                elif visited[v] == 0:
                    parent[v] = u
                    if dfs(v):
                        return True
            visited[u] = 2  # fully visited
            return False

        for node_id in self.nodes:
            if visited[node_id] == 0:
                if dfs(node_id):
                    return cycle_path

        return None

    def validate_dag(self):
        """Validates that graph contains no cycles; raises CycleDetectedException if cyclic."""
        cycle = self.detect_cycles()
        if cycle:
            raise CycleDetectedException(cycle)

    def topological_sort(self) -> List[str]:
        """
        Returns a topological ordering of node IDs using Kahn's algorithm.
        Raises CycleDetectedException if a cycle is detected.
        """
        self.validate_dag()

        in_degree: Dict[str, int] = {
            node_id: len(node.prerequisites) for node_id, node in self.nodes.items()
        }
        # Start with nodes that have in-degree 0 (no prerequisites)
        queue = deque([node_id for node_id, deg in in_degree.items() if deg == 0])
        sorted_order: List[str] = []

        while queue:
            curr = queue.popleft()
            sorted_order.append(curr)
            for dep in self.nodes[curr].dependents:
                in_degree[dep] -= 1
                if in_degree[dep] == 0:
                    queue.append(dep)

        if len(sorted_order) != len(self.nodes):
            # Should have been caught by validate_dag, but guard here as well
            raise CycleDetectedException(["cycle_detected"])

        return sorted_order

    def get_parallel_groups(self) -> List[List[str]]:
        """
        Partitions the DAG into parallel execution waves/stages.
        Each wave contains nodes whose prerequisites all belong to earlier waves.
        Returns a list of stages, where each stage is a list of node IDs executable concurrently.
        """
        topo_order = self.topological_sort()
        # Level / depth of each node in the DAG
        levels: Dict[str, int] = {}

        for node_id in topo_order:
            node = self.nodes[node_id]
            if not node.prerequisites:
                levels[node_id] = 0
            else:
                max_prereq_level = max(levels[p] for p in node.prerequisites)
                levels[node_id] = max_prereq_level + 1

        # Group by level
        groups_by_level: Dict[int, List[str]] = defaultdict(list)
        for node_id, lvl in levels.items():
            groups_by_level[lvl].append(node_id)

        # Return sorted by level index
        return [groups_by_level[lvl] for lvl in sorted(groups_by_level.keys())]

    def calculate_critical_path(self) -> Tuple[int, List[str]]:
        """
        Calculates the critical path (the longest path through the DAG in terms of duration).
        Uses dynamic programming on the topological sort.
        Returns:
            (total_critical_timeline_days, critical_path_node_ids)
        """
        if not self.nodes:
            return 0, []

        topo_order = self.topological_sort()

        # earlist_finish[u] = duration of longest path ending at node u
        # predecessor[u] = previous node on the longest path to u
        earliest_finish: Dict[str, int] = {}
        predecessor: Dict[str, Optional[str]] = {}

        for node_id in topo_order:
            node = self.nodes[node_id]
            if not node.prerequisites:
                earliest_finish[node_id] = node.duration
                predecessor[node_id] = None
            else:
                # Find prerequisite with maximum finish time
                best_prereq = max(node.prerequisites, key=lambda p: earliest_finish[p])
                earliest_finish[node_id] = earliest_finish[best_prereq] + node.duration
                predecessor[node_id] = best_prereq

        # Overall maximum finish time
        end_node = max(topo_order, key=lambda n: earliest_finish[n])
        total_timeline = earliest_finish[end_node]

        # Reconstruct path from end_node back to root
        path: List[str] = []
        curr: Optional[str] = end_node
        while curr is not None:
            path.append(curr)
            curr = predecessor.get(curr)

        path.reverse()
        return total_timeline, path

    def export_react_flow(self, critical_path_nodes: Optional[Set[str]] = None) -> Dict[str, Any]:
        """
        Exports the DAG as React Flow nodes and edges with computed layout coordinates.
        Layout places stages horizontally (X) and parallel nodes vertically (Y).
        """
        critical_set = set(critical_path_nodes or [])
        parallel_groups = self.get_parallel_groups()

        rf_nodes: List[Dict[str, Any]] = []
        rf_edges: List[Dict[str, Any]] = []

        X_SPACING = 320
        Y_SPACING = 160

        for stage_idx, stage_nodes in enumerate(parallel_groups):
            # Center the vertical stack for visual balance
            y_offset = (len(stage_nodes) - 1) * Y_SPACING / 2
            for node_idx, node_id in enumerate(stage_nodes):
                node = self.nodes[node_id]
                x_pos = stage_idx * X_SPACING + 50
                y_pos = (node_idx * Y_SPACING) - y_offset + 250

                rf_nodes.append({
                    "id": node.id,
                    "type": "approvalNode",
                    "position": {"x": x_pos, "y": y_pos},
                    "data": {
                        "requirement_id": node.id,
                        "label": node.name,
                        "department": node.department or "Regulatory Authority",
                        "duration": node.duration,
                        "data_status": node.data_status,
                        "is_critical_path": node.id in critical_set,
                        "stage": stage_idx + 1,
                        "prerequisites": node.prerequisites,
                        "dependents": node.dependents,
                    },
                })

                # Create edges from prerequisites to this node
                for prereq_id in node.prerequisites:
                    is_critical_edge = (node_id in critical_set) and (prereq_id in critical_set)
                    edge_id = f"e-{prereq_id}-{node_id}"
                    rf_edges.append({
                        "id": edge_id,
                        "source": prereq_id,
                        "target": node_id,
                        "animated": is_critical_edge,
                        "style": {
                            "stroke": "#ef4444" if is_critical_edge else "#94a3b8",
                            "strokeWidth": 2.5 if is_critical_edge else 1.5,
                        },
                    })

        return {
            "nodes": rf_nodes,
            "edges": rf_edges,
            "parallel_stages": len(parallel_groups),
            "total_nodes": len(self.nodes),
        }
