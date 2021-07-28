<?xml version="1.0" encoding="UTF-8"?>
<model ref="r:d22a1b4a-15e3-4d97-b665-acd3f1053f80(GenericDSL.typesystem)">
  <persistence version="9" />
  <languages>
    <use id="7a5dda62-9140-4668-ab76-d5ed1746f2b2" name="jetbrains.mps.lang.typesystem" version="5" />
    <devkit ref="00000000-0000-4000-0000-1de82b3a4936(jetbrains.mps.devkit.aspect.typesystem)" />
  </languages>
  <imports>
    <import index="uaqk" ref="r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)" implicit="true" />
    <import index="tpck" ref="r:00000000-0000-4000-0000-011c89590288(jetbrains.mps.lang.core.structure)" implicit="true" />
  </imports>
  <registry>
    <language id="f3061a53-9226-4cc5-a443-f952ceaf5816" name="jetbrains.mps.baseLanguage">
      <concept id="4836112446988635817" name="jetbrains.mps.baseLanguage.structure.UndefinedType" flags="in" index="2jxLKc" />
      <concept id="1197027756228" name="jetbrains.mps.baseLanguage.structure.DotExpression" flags="nn" index="2OqwBi">
        <child id="1197027771414" name="operand" index="2Oq$k0" />
        <child id="1197027833540" name="operation" index="2OqNvi" />
      </concept>
      <concept id="1070475926800" name="jetbrains.mps.baseLanguage.structure.StringLiteral" flags="nn" index="Xl_RD">
        <property id="1070475926801" name="value" index="Xl_RC" />
      </concept>
      <concept id="1068431474542" name="jetbrains.mps.baseLanguage.structure.VariableDeclaration" flags="ng" index="33uBYm">
        <child id="1068431790190" name="initializer" index="33vP2m" />
      </concept>
      <concept id="1068498886296" name="jetbrains.mps.baseLanguage.structure.VariableReference" flags="nn" index="37vLTw">
        <reference id="1068581517664" name="variableDeclaration" index="3cqZAo" />
      </concept>
      <concept id="1225271221393" name="jetbrains.mps.baseLanguage.structure.NPENotEqualsExpression" flags="nn" index="17QLQc" />
      <concept id="1225271283259" name="jetbrains.mps.baseLanguage.structure.NPEEqualsExpression" flags="nn" index="17R0WA" />
      <concept id="4972933694980447171" name="jetbrains.mps.baseLanguage.structure.BaseVariableDeclaration" flags="ng" index="19Szcq">
        <child id="5680397130376446158" name="type" index="1tU5fm" />
      </concept>
      <concept id="1068580123155" name="jetbrains.mps.baseLanguage.structure.ExpressionStatement" flags="nn" index="3clFbF">
        <child id="1068580123156" name="expression" index="3clFbG" />
      </concept>
      <concept id="1068580123159" name="jetbrains.mps.baseLanguage.structure.IfStatement" flags="nn" index="3clFbJ">
        <child id="1068580123160" name="condition" index="3clFbw" />
        <child id="1068580123161" name="ifTrue" index="3clFbx" />
      </concept>
      <concept id="1068580123136" name="jetbrains.mps.baseLanguage.structure.StatementList" flags="sn" stub="5293379017992965193" index="3clFbS">
        <child id="1068581517665" name="statement" index="3cqZAp" />
      </concept>
      <concept id="1068581242864" name="jetbrains.mps.baseLanguage.structure.LocalVariableDeclarationStatement" flags="nn" index="3cpWs8">
        <child id="1068581242865" name="localVariableDeclaration" index="3cpWs9" />
      </concept>
      <concept id="1068581242863" name="jetbrains.mps.baseLanguage.structure.LocalVariableDeclaration" flags="nr" index="3cpWsn" />
      <concept id="1081773326031" name="jetbrains.mps.baseLanguage.structure.BinaryOperation" flags="nn" index="3uHJSO">
        <child id="1081773367579" name="rightExpression" index="3uHU7w" />
        <child id="1081773367580" name="leftExpression" index="3uHU7B" />
      </concept>
      <concept id="1080120340718" name="jetbrains.mps.baseLanguage.structure.AndExpression" flags="nn" index="1Wc70l" />
    </language>
    <language id="fd392034-7849-419d-9071-12563d152375" name="jetbrains.mps.baseLanguage.closures">
      <concept id="1199569711397" name="jetbrains.mps.baseLanguage.closures.structure.ClosureLiteral" flags="nn" index="1bVj0M">
        <child id="1199569906740" name="parameter" index="1bW2Oz" />
        <child id="1199569916463" name="body" index="1bW5cS" />
      </concept>
    </language>
    <language id="7a5dda62-9140-4668-ab76-d5ed1746f2b2" name="jetbrains.mps.lang.typesystem">
      <concept id="1175517767210" name="jetbrains.mps.lang.typesystem.structure.ReportErrorStatement" flags="nn" index="2MkqsV">
        <child id="1175517851849" name="errorString" index="2MkJ7o" />
      </concept>
      <concept id="1195213580585" name="jetbrains.mps.lang.typesystem.structure.AbstractCheckingRule" flags="ig" index="18hYwZ">
        <child id="1195213635060" name="body" index="18ibNy" />
      </concept>
      <concept id="1195214364922" name="jetbrains.mps.lang.typesystem.structure.NonTypesystemRule" flags="ig" index="18kY7G" />
      <concept id="3937244445246642777" name="jetbrains.mps.lang.typesystem.structure.AbstractReportStatement" flags="ng" index="1urrMJ">
        <child id="3937244445246642781" name="nodeToReport" index="1urrMF" />
      </concept>
      <concept id="1174642788531" name="jetbrains.mps.lang.typesystem.structure.ConceptReference" flags="ig" index="1YaCAy">
        <reference id="1174642800329" name="concept" index="1YaFvo" />
      </concept>
      <concept id="1174648085619" name="jetbrains.mps.lang.typesystem.structure.AbstractRule" flags="ng" index="1YuPPy">
        <child id="1174648101952" name="applicableNode" index="1YuTPh" />
      </concept>
      <concept id="1174650418652" name="jetbrains.mps.lang.typesystem.structure.ApplicableNodeReference" flags="nn" index="1YBJjd">
        <reference id="1174650432090" name="applicableNode" index="1YBMHb" />
      </concept>
    </language>
    <language id="7866978e-a0f0-4cc7-81bc-4d213d9375e1" name="jetbrains.mps.lang.smodel">
      <concept id="1177026924588" name="jetbrains.mps.lang.smodel.structure.RefConcept_Reference" flags="nn" index="chp4Y">
        <reference id="1177026940964" name="conceptDeclaration" index="cht4Q" />
      </concept>
      <concept id="1138411891628" name="jetbrains.mps.lang.smodel.structure.SNodeOperation" flags="nn" index="eCIE_">
        <child id="1144104376918" name="parameter" index="1xVPHs" />
      </concept>
      <concept id="1171305280644" name="jetbrains.mps.lang.smodel.structure.Node_GetDescendantsOperation" flags="nn" index="2Rf3mk" />
      <concept id="1171407110247" name="jetbrains.mps.lang.smodel.structure.Node_GetAncestorOperation" flags="nn" index="2Xjw5R" />
      <concept id="1144101972840" name="jetbrains.mps.lang.smodel.structure.OperationParm_Concept" flags="ng" index="1xMEDy">
        <child id="1207343664468" name="conceptArgument" index="ri$Ld" />
      </concept>
      <concept id="1138055754698" name="jetbrains.mps.lang.smodel.structure.SNodeType" flags="in" index="3Tqbb2">
        <reference id="1138405853777" name="concept" index="ehGHo" />
      </concept>
      <concept id="1138056022639" name="jetbrains.mps.lang.smodel.structure.SPropertyAccess" flags="nn" index="3TrcHB">
        <reference id="1138056395725" name="property" index="3TsBF5" />
      </concept>
    </language>
    <language id="ceab5195-25ea-4f22-9b92-103b95ca8c0c" name="jetbrains.mps.lang.core">
      <concept id="1169194658468" name="jetbrains.mps.lang.core.structure.INamedConcept" flags="ng" index="TrEIO">
        <property id="1169194664001" name="name" index="TrG5h" />
      </concept>
    </language>
    <language id="83888646-71ce-4f1c-9c53-c54016f6ad4f" name="jetbrains.mps.baseLanguage.collections">
      <concept id="1204796164442" name="jetbrains.mps.baseLanguage.collections.structure.InternalSequenceOperation" flags="nn" index="23sCx2">
        <child id="1204796294226" name="closure" index="23t8la" />
      </concept>
      <concept id="1151689724996" name="jetbrains.mps.baseLanguage.collections.structure.SequenceType" flags="in" index="A3Dl8">
        <child id="1151689745422" name="elementType" index="A3Ik2" />
      </concept>
      <concept id="1235566554328" name="jetbrains.mps.baseLanguage.collections.structure.AnyOperation" flags="nn" index="2HwmR7" />
      <concept id="1203518072036" name="jetbrains.mps.baseLanguage.collections.structure.SmartClosureParameterDeclaration" flags="ig" index="Rh6nW" />
    </language>
  </registry>
  <node concept="18kY7G" id="5w2nDnaBnXg">
    <property role="TrG5h" value="check_Parent" />
    <node concept="3clFbS" id="5w2nDnaBnXh" role="18ibNy">
      <node concept="3cpWs8" id="1iXgOnc7gt0" role="3cqZAp">
        <node concept="3cpWsn" id="1iXgOnc7gt3" role="3cpWs9">
          <property role="TrG5h" value="root" />
          <node concept="3Tqbb2" id="1iXgOnc7gsZ" role="1tU5fm">
            <ref role="ehGHo" to="uaqk:5w2nDnaB6wz" resolve="Root" />
          </node>
          <node concept="2OqwBi" id="1iXgOnc7gCW" role="33vP2m">
            <node concept="2Xjw5R" id="1iXgOnc7gPp" role="2OqNvi">
              <node concept="1xMEDy" id="1iXgOnc7gPr" role="1xVPHs">
                <node concept="chp4Y" id="5w2nDnaBoW6" role="ri$Ld">
                  <ref role="cht4Q" to="uaqk:5w2nDnaB6wz" resolve="Root" />
                </node>
              </node>
            </node>
            <node concept="1YBJjd" id="5w2nDnaBp8z" role="2Oq$k0">
              <ref role="1YBMHb" node="5w2nDnaBnXj" resolve="parent" />
            </node>
          </node>
        </node>
      </node>
      <node concept="3cpWs8" id="1iXgOnc7hXt" role="3cqZAp">
        <node concept="3cpWsn" id="1iXgOnc7hXw" role="3cpWs9">
          <property role="TrG5h" value="parents" />
          <node concept="A3Dl8" id="1iXgOnc7hXq" role="1tU5fm">
            <node concept="3Tqbb2" id="1iXgOnc7hXV" role="A3Ik2">
              <ref role="ehGHo" to="uaqk:5w2nDnaB6ww" resolve="Parent" />
            </node>
          </node>
          <node concept="2OqwBi" id="1iXgOnc7i90" role="33vP2m">
            <node concept="37vLTw" id="1iXgOnc7hYD" role="2Oq$k0">
              <ref role="3cqZAo" node="1iXgOnc7gt3" resolve="root" />
            </node>
            <node concept="2Rf3mk" id="1iXgOnc7iaA" role="2OqNvi">
              <node concept="1xMEDy" id="1iXgOnc7iaC" role="1xVPHs">
                <node concept="chp4Y" id="5w2nDnaBoKH" role="ri$Ld">
                  <ref role="cht4Q" to="uaqk:5w2nDnaB6ww" resolve="Parent" />
                </node>
              </node>
            </node>
          </node>
        </node>
      </node>
      <node concept="3clFbJ" id="1iXgOnc7gS6" role="3cqZAp">
        <node concept="3clFbS" id="1iXgOnc7gS8" role="3clFbx">
          <node concept="2MkqsV" id="1iXgOnc7pnu" role="3cqZAp">
            <node concept="Xl_RD" id="1iXgOnc7pnH" role="2MkJ7o">
              <property role="Xl_RC" value="duplicate parent name" />
            </node>
            <node concept="1YBJjd" id="5w2nDnaBoHB" role="1urrMF">
              <ref role="1YBMHb" node="5w2nDnaBnXj" resolve="parent" />
            </node>
          </node>
        </node>
        <node concept="2OqwBi" id="1iXgOnc7itH" role="3clFbw">
          <node concept="37vLTw" id="1iXgOnc7ig4" role="2Oq$k0">
            <ref role="3cqZAo" node="1iXgOnc7hXw" resolve="parents" />
          </node>
          <node concept="2HwmR7" id="1iXgOnc7j2t" role="2OqNvi">
            <node concept="1bVj0M" id="1iXgOnc7j2v" role="23t8la">
              <node concept="3clFbS" id="1iXgOnc7j2w" role="1bW5cS">
                <node concept="3clFbF" id="1iXgOnc7j5A" role="3cqZAp">
                  <node concept="1Wc70l" id="1iXgOnc7kQv" role="3clFbG">
                    <node concept="17QLQc" id="1iXgOnc7lqN" role="3uHU7w">
                      <node concept="37vLTw" id="1iXgOnc7kTG" role="3uHU7B">
                        <ref role="3cqZAo" node="1iXgOnc7j2x" resolve="it" />
                      </node>
                      <node concept="1YBJjd" id="5w2nDnaBoqA" role="3uHU7w">
                        <ref role="1YBMHb" node="5w2nDnaBnXj" resolve="parent" />
                      </node>
                    </node>
                    <node concept="17R0WA" id="1iXgOnc7leM" role="3uHU7B">
                      <node concept="2OqwBi" id="1iXgOnc7jiQ" role="3uHU7B">
                        <node concept="37vLTw" id="1iXgOnc7j5_" role="2Oq$k0">
                          <ref role="3cqZAo" node="1iXgOnc7j2x" resolve="it" />
                        </node>
                        <node concept="3TrcHB" id="1iXgOnc7jy2" role="2OqNvi">
                          <ref role="3TsBF5" to="tpck:h0TrG11" resolve="name" />
                        </node>
                      </node>
                      <node concept="2OqwBi" id="1iXgOnc7kwJ" role="3uHU7w">
                        <node concept="3TrcHB" id="1iXgOnc7kNh" role="2OqNvi">
                          <ref role="3TsBF5" to="tpck:h0TrG11" resolve="name" />
                        </node>
                        <node concept="1YBJjd" id="5w2nDnaBohN" role="2Oq$k0">
                          <ref role="1YBMHb" node="5w2nDnaBnXj" resolve="parent" />
                        </node>
                      </node>
                    </node>
                  </node>
                </node>
              </node>
              <node concept="Rh6nW" id="1iXgOnc7j2x" role="1bW2Oz">
                <property role="TrG5h" value="it" />
                <node concept="2jxLKc" id="1iXgOnc7j2y" role="1tU5fm" />
              </node>
            </node>
          </node>
        </node>
      </node>
    </node>
    <node concept="1YaCAy" id="5w2nDnaBnXj" role="1YuTPh">
      <property role="TrG5h" value="parent" />
      <ref role="1YaFvo" to="uaqk:5w2nDnaB6ww" resolve="Parent" />
    </node>
  </node>
  <node concept="18kY7G" id="5w2nDnaBp$8">
    <property role="TrG5h" value="check_Child" />
    <node concept="3clFbS" id="5w2nDnaBp$9" role="18ibNy">
      <node concept="3cpWs8" id="5w2nDnaBp$k" role="3cqZAp">
        <node concept="3cpWsn" id="5w2nDnaBp$l" role="3cpWs9">
          <property role="TrG5h" value="parent" />
          <node concept="3Tqbb2" id="5w2nDnaBp$m" role="1tU5fm">
            <ref role="ehGHo" to="uaqk:5w2nDnaB6ww" resolve="Parent" />
          </node>
          <node concept="2OqwBi" id="5w2nDnaBp$n" role="33vP2m">
            <node concept="2Xjw5R" id="5w2nDnaBp$o" role="2OqNvi">
              <node concept="1xMEDy" id="5w2nDnaBp$p" role="1xVPHs">
                <node concept="chp4Y" id="5w2nDnaBq7T" role="ri$Ld">
                  <ref role="cht4Q" to="uaqk:5w2nDnaB6ww" resolve="Parent" />
                </node>
              </node>
            </node>
            <node concept="1YBJjd" id="5w2nDnaBq0c" role="2Oq$k0">
              <ref role="1YBMHb" node="5w2nDnaBp$b" resolve="child" />
            </node>
          </node>
        </node>
      </node>
      <node concept="3cpWs8" id="5w2nDnaBp$s" role="3cqZAp">
        <node concept="3cpWsn" id="5w2nDnaBp$t" role="3cpWs9">
          <property role="TrG5h" value="children" />
          <node concept="A3Dl8" id="5w2nDnaBp$u" role="1tU5fm">
            <node concept="3Tqbb2" id="5w2nDnaBp$v" role="A3Ik2">
              <ref role="ehGHo" to="uaqk:5w2nDnaB6wD" resolve="Child" />
            </node>
          </node>
          <node concept="2OqwBi" id="5w2nDnaBp$w" role="33vP2m">
            <node concept="37vLTw" id="5w2nDnaBp$x" role="2Oq$k0">
              <ref role="3cqZAo" node="5w2nDnaBp$l" resolve="parent" />
            </node>
            <node concept="2Rf3mk" id="5w2nDnaBp$y" role="2OqNvi">
              <node concept="1xMEDy" id="5w2nDnaBp$z" role="1xVPHs">
                <node concept="chp4Y" id="5w2nDnaBquB" role="ri$Ld">
                  <ref role="cht4Q" to="uaqk:5w2nDnaB6wD" resolve="Child" />
                </node>
              </node>
            </node>
          </node>
        </node>
      </node>
      <node concept="3clFbJ" id="5w2nDnaBp$_" role="3cqZAp">
        <node concept="3clFbS" id="5w2nDnaBp$A" role="3clFbx">
          <node concept="2MkqsV" id="5w2nDnaBp$B" role="3cqZAp">
            <node concept="Xl_RD" id="5w2nDnaBp$C" role="2MkJ7o">
              <property role="Xl_RC" value="duplicate child name" />
            </node>
            <node concept="1YBJjd" id="5w2nDnaBqSO" role="1urrMF">
              <ref role="1YBMHb" node="5w2nDnaBp$b" resolve="child" />
            </node>
          </node>
        </node>
        <node concept="2OqwBi" id="5w2nDnaBp$E" role="3clFbw">
          <node concept="37vLTw" id="5w2nDnaBp$F" role="2Oq$k0">
            <ref role="3cqZAo" node="5w2nDnaBp$t" resolve="children" />
          </node>
          <node concept="2HwmR7" id="5w2nDnaBp$G" role="2OqNvi">
            <node concept="1bVj0M" id="5w2nDnaBp$H" role="23t8la">
              <node concept="3clFbS" id="5w2nDnaBp$I" role="1bW5cS">
                <node concept="3clFbF" id="5w2nDnaBp$J" role="3cqZAp">
                  <node concept="1Wc70l" id="5w2nDnaBp$K" role="3clFbG">
                    <node concept="17QLQc" id="5w2nDnaBp$L" role="3uHU7w">
                      <node concept="37vLTw" id="5w2nDnaBp$M" role="3uHU7B">
                        <ref role="3cqZAo" node="5w2nDnaBp$V" resolve="it" />
                      </node>
                      <node concept="1YBJjd" id="5w2nDnaBqMm" role="3uHU7w">
                        <ref role="1YBMHb" node="5w2nDnaBp$b" resolve="child" />
                      </node>
                    </node>
                    <node concept="17R0WA" id="5w2nDnaBp$O" role="3uHU7B">
                      <node concept="2OqwBi" id="5w2nDnaBp$P" role="3uHU7B">
                        <node concept="37vLTw" id="5w2nDnaBp$Q" role="2Oq$k0">
                          <ref role="3cqZAo" node="5w2nDnaBp$V" resolve="it" />
                        </node>
                        <node concept="3TrcHB" id="5w2nDnaBp$R" role="2OqNvi">
                          <ref role="3TsBF5" to="tpck:h0TrG11" resolve="name" />
                        </node>
                      </node>
                      <node concept="2OqwBi" id="5w2nDnaBp$S" role="3uHU7w">
                        <node concept="3TrcHB" id="5w2nDnaBp$T" role="2OqNvi">
                          <ref role="3TsBF5" to="tpck:h0TrG11" resolve="name" />
                        </node>
                        <node concept="1YBJjd" id="5w2nDnaBqFQ" role="2Oq$k0">
                          <ref role="1YBMHb" node="5w2nDnaBp$b" resolve="child" />
                        </node>
                      </node>
                    </node>
                  </node>
                </node>
              </node>
              <node concept="Rh6nW" id="5w2nDnaBp$V" role="1bW2Oz">
                <property role="TrG5h" value="it" />
                <node concept="2jxLKc" id="5w2nDnaBp$W" role="1tU5fm" />
              </node>
            </node>
          </node>
        </node>
      </node>
    </node>
    <node concept="1YaCAy" id="5w2nDnaBp$b" role="1YuTPh">
      <property role="TrG5h" value="child" />
      <ref role="1YaFvo" to="uaqk:5w2nDnaB6wD" resolve="Child" />
    </node>
  </node>
</model>

