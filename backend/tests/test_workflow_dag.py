import pytest
from app.workflow.dag import ApprovalDAG, CycleDetectedException
from app.workflow.service import WorkflowService
from app.models.workflow import StepStatus, ApplicationStatus


class TestApprovalDAGAlgorithms:
    """Tests for DAG topological sort, cycle detection, parallel grouping, and critical path."""

    def test_empty_dag(self):
        dag = ApprovalDAG()
        assert dag.detect_cycles() is None
        assert dag.topological_sort() == []
        assert dag.get_parallel_groups() == []
        timeline, path = dag.calculate_critical_path()
        assert timeline == 0
        assert path == []

    def test_single_node_dag(self):
        dag = ApprovalDAG()
        dag.add_node(id="A", name="Step A", duration=10, prerequisites=[])
        dag.build_edges()

        assert dag.detect_cycles() is None
        assert dag.topological_sort() == ["A"]
        assert dag.get_parallel_groups() == [["A"]]
        timeline, path = dag.calculate_critical_path()
        assert timeline == 10
        assert path == ["A"]

    def test_linear_dag(self):
        # A (10) -> B (20) -> C (15)
        dag = ApprovalDAG()
        dag.add_node(id="A", name="Step A", duration=10, prerequisites=[])
        dag.add_node(id="B", name="Step B", duration=20, prerequisites=["A"])
        dag.add_node(id="C", name="Step C", duration=15, prerequisites=["B"])
        dag.build_edges()

        assert dag.detect_cycles() is None
        assert dag.topological_sort() == ["A", "B", "C"]
        assert dag.get_parallel_groups() == [["A"], ["B"], ["C"]]
        timeline, path = dag.calculate_critical_path()
        assert timeline == 45  # 10 + 20 + 15
        assert path == ["A", "B", "C"]

    def test_parallel_branches_and_critical_path(self):
        """
        Root: Siting (20d)
        Branch 1: CTE (40d) -> HazWaste (30d)  => 20 + 40 + 30 = 90d (CRITICAL PATH)
        Branch 2: Factory (25d) -> Fire (15d)   => 20 + 25 + 15 = 60d
        Branch 3: HT Power (10d)               => 20 + 10 = 30d
        """
        dag = ApprovalDAG()
        dag.add_node(id="REQ-SITING", name="Siting", duration=20, prerequisites=[])
        dag.add_node(id="REQ-CTE", name="CTE", duration=40, prerequisites=["REQ-SITING"])
        dag.add_node(id="REQ-HAZ", name="HazWaste", duration=30, prerequisites=["REQ-CTE"])
        dag.add_node(id="REQ-FACTORY", name="Factory", duration=25, prerequisites=["REQ-SITING"])
        dag.add_node(id="REQ-FIRE", name="Fire", duration=15, prerequisites=["REQ-FACTORY"])
        dag.add_node(id="REQ-POWER", name="HT Power", duration=10, prerequisites=["REQ-SITING"])
        dag.build_edges()

        assert dag.detect_cycles() is None

        # Topological sort respects prerequisites
        topo = dag.topological_sort()
        assert topo.index("REQ-SITING") < topo.index("REQ-CTE")
        assert topo.index("REQ-SITING") < topo.index("REQ-FACTORY")
        assert topo.index("REQ-SITING") < topo.index("REQ-POWER")
        assert topo.index("REQ-CTE") < topo.index("REQ-HAZ")
        assert topo.index("REQ-FACTORY") < topo.index("REQ-FIRE")

        # Parallel groups
        groups = dag.get_parallel_groups()
        assert len(groups) == 3
        # Stage 0: Siting
        assert groups[0] == ["REQ-SITING"]
        # Stage 1: CTE, Factory, HT Power can proceed in parallel
        assert set(groups[1]) == {"REQ-CTE", "REQ-FACTORY", "REQ-POWER"}
        # Stage 2: HazWaste and Fire can proceed in parallel once their respective prereqs finish
        assert set(groups[2]) == {"REQ-HAZ", "REQ-FIRE"}

        # Critical path calculation
        timeline, path = dag.calculate_critical_path()
        assert timeline == 90
        assert path == ["REQ-SITING", "REQ-CTE", "REQ-HAZ"]

    def test_cycle_detection_simple(self):
        # A -> B -> A
        dag = ApprovalDAG()
        dag.add_node(id="A", name="Step A", duration=10, prerequisites=["B"])
        dag.add_node(id="B", name="Step B", duration=10, prerequisites=["A"])

        cycle = dag.detect_cycles()
        assert cycle is not None
        assert "A" in cycle and "B" in cycle

        with pytest.raises(CycleDetectedException):
            dag.topological_sort()

    def test_cycle_detection_triangular(self):
        # A -> B -> C -> A
        dag = ApprovalDAG()
        dag.add_node(id="A", name="Step A", duration=5, prerequisites=["C"])
        dag.add_node(id="B", name="Step B", duration=5, prerequisites=["A"])
        dag.add_node(id="C", name="Step C", duration=5, prerequisites=["B"])

        cycle = dag.detect_cycles()
        assert cycle is not None
        with pytest.raises(CycleDetectedException):
            dag.validate_dag()

    def test_filter_nonexistent_prerequisites(self):
        """If a prerequisite is not in the graph (e.g. not required for this business), it is cleanly ignored."""
        dag = ApprovalDAG()
        dag.add_node(id="A", name="Step A", duration=10, prerequisites=["OPTIONAL_NON_EXISTENT"])
        dag.build_edges(filter_existing_prereqs_only=True)

        assert dag.nodes["A"].prerequisites == []
        assert dag.detect_cycles() is None
        assert dag.topological_sort() == ["A"]

    def test_react_flow_export(self):
        dag = ApprovalDAG()
        dag.add_node(id="A", name="Step A", duration=10, prerequisites=[])
        dag.add_node(id="B", name="Step B", duration=20, prerequisites=["A"])
        dag.build_edges()

        rf = dag.export_react_flow(critical_path_nodes={"A", "B"})
        assert rf["total_nodes"] == 2
        assert rf["parallel_stages"] == 2
        assert len(rf["nodes"]) == 2
        assert len(rf["edges"]) == 1

        edge = rf["edges"][0]
        assert edge["source"] == "A"
        assert edge["target"] == "B"
        assert edge["animated"] is True
        assert edge["style"]["stroke"] == "#ef4444"  # Critical path highlighted in red
